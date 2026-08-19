const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fetch = require("node-fetch");
const FormData = require("form-data");
const qrcode = require("qrcode-terminal");
const http = require("http");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const BSP_API_KEY = process.env.BSP_API_KEY || "";
const SELF_TEST = process.env.SELF_TEST === "true";

// Resolve supplier ID: CLI arg (--supplier-id=X) takes precedence over env var
const cliArg = process.argv.find((a) => a.startsWith("--supplier-id="));
const SUPPLIER_ID = cliArg ? cliArg.split("=")[1] : process.env.SUPPLIER_ID;

if (!SUPPLIER_ID) {
  console.error(
    "ERROR: SUPPLIER_ID is required. Pass --supplier-id=X or set SUPPLIER_ID env var.",
  );
  process.exit(1);
}

// Bridge port defaults to 3001 but can be overridden per supplier
const BRIDGE_PORT = process.env.BRIDGE_PORT || 3001;

console.log(
  `[bridge] Starting for supplier ${SUPPLIER_ID} on port ${BRIDGE_PORT}`,
);

// Shared socket reference — set once WhatsApp connects
let activeSock = null;

// ── Inbound: Whisper transcription ──────────────────────────────────────────

async function transcribeAudio(sock, msg) {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      { reuploadRequest: sock.updateMediaMessage },
    );

    const form = new FormData();
    form.append("file", buffer, {
      filename: "audio.ogg",
      contentType: "audio/ogg",
    });
    form.append("model", "whisper-large-v3");
    form.append("language", "en");

    const res = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      },
    );

    const data = await res.json();
    if (data.text) {
      console.log(`[Whisper] transcribed: "${data.text}"`);
      return data.text;
    }
    console.error("[Whisper] no text in response:", JSON.stringify(data));
    return null;
  } catch (err) {
    console.error("[Whisper] error:", err.message);
    return null;
  }
}

// ── Inbound: forward to backend ──────────────────────────────────────────────

async function forwardToBackend(msgId, from, body) {
  try {
    const res = await fetch(`${BACKEND_URL}/webhook/${SUPPLIER_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ id: msgId, from, type: "text", text: { body } }],
      }),
    });
    console.log(`[→ backend] ${from}: "${body}" — ${res.status}`);
  } catch (err) {
    console.error("[→ backend] error:", err.message);
  }
}

// ── Outbound HTTP server (backend → bridge → WhatsApp) ───────────────────────

const bridgeServer = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk.toString()));
  req.on("end", async () => {
    try {
      // Validate API key if BSP_API_KEY is set
      if (BSP_API_KEY) {
        const auth = req.headers["authorization"] || "";
        if (auth !== `Bearer ${BSP_API_KEY}`) {
          res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
      }

      if (!activeSock) {
        res
          .writeHead(503)
          .end(JSON.stringify({ error: "WhatsApp not connected yet" }));
        return;
      }

      const data = JSON.parse(body);
      // Use full JID directly if it contains @, otherwise fall back to @s.whatsapp.net
      const jid = data.to.includes("@") ? data.to : `${data.to}@s.whatsapp.net`;

      if (req.url === "/send") {
        await activeSock.sendMessage(jid, { text: data.message });
        console.log(`[← bridge] text → ${data.to}`);
        res.writeHead(200).end(JSON.stringify({ ok: true }));
      } else if (req.url === "/send-document") {
        const buffer = Buffer.from(data.base64, "base64");
        await activeSock.sendMessage(jid, {
          document: buffer,
          mimetype: "application/pdf",
          fileName: data.filename,
        });
        console.log(`[← bridge] PDF "${data.filename}" → ${data.to}`);
        res.writeHead(200).end(JSON.stringify({ ok: true }));
      } else {
        res.writeHead(404).end();
      }
    } catch (err) {
      console.error("[bridge HTTP] error:", err.message);
      res.writeHead(500).end(JSON.stringify({ error: err.message }));
    }
  });
});

bridgeServer.listen(BRIDGE_PORT, () => {
  console.log(`[bridge HTTP] outbound server listening on port ${BRIDGE_PORT}`);
});

// ── WhatsApp connection ───────────────────────────────────────────────────────

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(
    `auth_state/${SUPPLIER_ID}`,
  );
  const sock = makeWASocket({ auth: state });
  activeSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log(
        "\nScan this QR code with WhatsApp → Linked Devices → Link a Device\n",
      );
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("Reconnecting...");
        activeSock = null;
        start();
      } else {
        console.log("Logged out. Delete auth_state/ folder and restart.");
      }
    } else if (connection === "open") {
      console.log(
        "✅ WhatsApp connected! Listening for messages and voice notes...",
      );
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) {
        // In self-test mode, allow "Note to Self" messages (remoteJid = own number)
        if (!SELF_TEST) continue;
        const ownNumber = sock.user?.id?.split(":")[0].split("@")[0];
        const remoteNumber = msg.key.remoteJid.split(":")[0].split("@")[0];
        if (ownNumber !== remoteNumber) continue; // skip outbound to clients
      }

      // Skip group messages — only handle 1-to-1 chats
      if (msg.key.remoteJid.endsWith("@g.us")) continue;

      // Keep full JID (handles both @s.whatsapp.net and @lid formats)
      const from = msg.key.remoteJid;

      let body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null;

      if (!body && msg.message?.audioMessage) {
        console.log(`[Whisper] voice note from ${from} — transcribing...`);
        body = await transcribeAudio(sock, msg);
      }

      if (!body) continue;
      await forwardToBackend(msg.key.id, from, body);
    }
  });
}

start();
