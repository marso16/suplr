const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const { Queue, Worker } = require("bullmq");
const fetch = require("node-fetch");
const FormData = require("form-data");
const qrcode = require("qrcode-terminal");
const http = require("http");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const BSP_API_KEY = process.env.BSP_API_KEY || "";
const SELF_TEST = process.env.SELF_TEST === "true";

// When set, only messages from these numbers are forwarded — everyone else is silently ignored.
// Comma-separated. Accepts phone numbers ("+96176057426") or full LID JIDs ("198908676448296@lid").
const WHITELIST_NUMBERS = process.env.WHITELIST_NUMBER
  ? process.env.WHITELIST_NUMBER.split(",").map((n) => n.trim()).filter(Boolean)
  : null;

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

console.log(`[bridge] Starting for supplier ${SUPPLIER_ID} on port ${BRIDGE_PORT}`);
if (WHITELIST_NUMBERS) {
  console.log(`[bridge] 🔒 Whitelist mode — only processing messages from: ${WHITELIST_NUMBERS.join(", ")}`);
} else {
  console.log(`[bridge] ⚠️  No whitelist — all incoming messages will be processed`);
}

// ── BullMQ — background job queues over Redis ────────────────────────────────

function parseBullConnection(redisUrl) {
  try {
    const u = new URL(redisUrl);
    return {
      host: u.hostname,
      port: parseInt(u.port || "6379", 10),
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

const bullConnection = parseBullConnection(process.env.REDIS_URL || "redis://localhost:6379");

const broadcastQueue = new Queue("broadcast", { connection: bullConnection });
const reminderQueue  = new Queue("order-reminder", { connection: bullConnection });

const JOB_OPTS = { attempts: 3, backoff: { type: "exponential", delay: 5_000 } };

new Worker(
  "broadcast",
  async (job) => {
    const { numbers, message } = job.data;
    if (!activeSock) throw new Error("WhatsApp not connected — will retry");
    for (const number of numbers) {
      const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
      await activeSock.sendMessage(jid, { text: message });
      console.log(`[broadcast job] sent → ${number}`);
    }
  },
  { connection: bullConnection }
);

new Worker(
  "order-reminder",
  async (job) => {
    const { number, message } = job.data;
    if (!activeSock) throw new Error("WhatsApp not connected — will retry");
    const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
    await activeSock.sendMessage(jid, { text: message });
    console.log(`[reminder job] sent → ${number}`);
  },
  { connection: bullConnection }
);

console.log("[bullmq] queues ready — broadcast · order-reminder");

// ── Shared socket reference — set once WhatsApp connects ─────────────────────
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
      } else if (req.url === "/queue/broadcast") {
        // { numbers: string[], message: string, delayMs?: number }
        const { numbers, message, delayMs = 0 } = data;
        const job = await broadcastQueue.add(
          "send",
          { numbers, message },
          { ...JOB_OPTS, delay: delayMs }
        );
        console.log(`[queue] broadcast job ${job.id} — delay ${delayMs}ms — ${numbers.length} recipients`);
        res.writeHead(200).end(JSON.stringify({ jobId: job.id }));
      } else if (req.url === "/queue/reminder") {
        // { number: string, message: string, delayMs?: number, jobId?: string }
        const { number, message, delayMs = 0, jobId } = data;
        const opts = { ...JOB_OPTS, delay: delayMs };
        if (jobId) opts.jobId = jobId; // deduplicates by order ID
        const job = await reminderQueue.add("send", { number, message }, opts);
        console.log(`[queue] reminder job ${job.id} — delay ${delayMs}ms → ${number}`);
        res.writeHead(200).end(JSON.stringify({ jobId: job.id }));
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

      // Whitelist filter — drop anyone not on the list
      if (WHITELIST_NUMBERS) {
        const fromDigits = from.replace(/\D/g, "");
        const allowed = WHITELIST_NUMBERS.some((w) => {
          if (w.includes("@")) return from === w;           // exact LID / JID match
          const wDigits = w.replace(/\D/g, "");
          return fromDigits.endsWith(wDigits) || wDigits.endsWith(fromDigits);
        });
        if (!allowed) {
          console.log(`[bridge] ⏭️  Ignored ${from} (not whitelisted)`);
          continue;
        }
      }

      await forwardToBackend(msg.key.id, from, body);
    }
  });
}

start();
