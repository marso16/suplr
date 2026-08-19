"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Client } from "@/types";

type Stage = "compose" | "confirm" | "done";

interface Result {
  sent: number;
  failed: number;
  total: number;
}

export default function BroadcastPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<Stage>("compose");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    api.clients
      .list()
      .then(setClients)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (stage === "compose") textareaRef.current?.focus();
  }, [stage]);

  async function handleSend() {
    setSending(true);
    try {
      const res = await api.broadcast.send(message.trim());
      setResult(res);
      setStage("done");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setMessage("");
    setStage("compose");
    setResult(null);
  }

  if (loading) return <LoadingScreen />;

  const canSend = message.trim().length > 0 && clients.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t("nav_broadcast")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Send a message to all your WhatsApp clients at once
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No clients yet — they appear once you receive a WhatsApp message.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6 max-w-5xl">
          {/* Left — compose / confirm / done */}
          <div className="col-span-3 space-y-4">
            {stage === "done" && result ? (
              /* Result card */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <svg
                    width="22"
                    height="22"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Broadcast sent
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    {result.sent} of {result.total} messages delivered
                    {result.failed > 0 && (
                      <span className="text-red-500 dark:text-red-400">
                        {" "}
                        · {result.failed} failed
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Send another broadcast →
                </button>
              </div>
            ) : stage === "confirm" ? (
              /* Confirmation step */
              <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="text-amber-500 flex-shrink-0 mt-0.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      This will send to {clients.length} client
                      {clients.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                {/* Message preview */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap border border-slate-200 dark:border-slate-700">
                  {message.trim()}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setStage("compose")}
                    disabled={sending}
                    className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 rounded-lg font-medium text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="animate-spin"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="white"
                            strokeWidth="2.5"
                            className="opacity-25"
                          />
                          <path
                            d="M12 2a10 10 0 0 1 10 10"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      `Confirm — Send to ${clients.length}`
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Compose */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Message
                  </label>
                  <textarea
                    ref={textareaRef}
                    rows={8}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      "Dear clients,\n\nWe have new arrivals and updated prices available. Don't hesitate to place your order!\n\nThank you for your continued trust."
                    }
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors resize-none"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-end">
                    {message.length} characters
                  </p>
                </div>

                <button
                  onClick={() => setStage("confirm")}
                  disabled={!canSend}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg
                    width="15"
                    height="15"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"
                    />
                  </svg>
                  Send to {clients.length} client
                  {clients.length !== 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>

          {/* Right — recipient list */}
          <div className="col-span-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  Recipients · {clients.length}
                </p>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {clients.map((c) => (
                  <div
                    key={c.id}
                    className="px-4 py-2.5 flex items-center gap-2.5"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {c.name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono leading-tight">
                        {c.whatsapp_number.replace(
                          /@s\.whatsapp\.net$|@lid$/,
                          "",
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
