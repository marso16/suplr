"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { BroadcastSkeleton } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Client } from "@/types";

type Stage = "compose" | "confirm" | "done";

interface Result {
  sent: number;
  failed: number;
  total: number;
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const STAGES: Stage[] = ["compose", "confirm", "done"];
const STAGE_LABELS: Record<Stage, string> = {
  compose: "Compose",
  confirm: "Review",
  done: "Sent",
};

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
    api.clients.list().then(setClients).finally(() => setLoading(false));
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

  if (loading) return <BroadcastSkeleton />;

  const canSend = message.trim().length > 0 && clients.length > 0;
  const stageIndex = STAGES.indexOf(stage);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t("nav_broadcast")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Send a message to all your WhatsApp clients at once
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            No clients yet — they appear once you receive a WhatsApp message.
          </p>
        </div>
      ) : (
        <>
        {/* Stage indicator — above both columns */}
        {stage !== "done" && (
          <div className="flex items-center gap-0 mb-4 max-w-5xl">
            {STAGES.slice(0, 2).map((s, i) => (
              <div key={s} className="flex items-center gap-0">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                  stageIndex >= i
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    stageIndex >= i
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  }`}>
                    {stageIndex > i ? (
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {STAGE_LABELS[s]}
                </div>
                {i < 1 && (
                  <div className={`w-8 h-px mx-2 ${stageIndex > i ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 max-w-5xl">
          {/* Left — compose / confirm / done */}
          <div className="lg:col-span-3">

            {stage === "done" && result ? (
              /* Result card */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
                <div className="flex flex-col items-center text-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                    <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>

                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Broadcast sent</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Your message was dispatched to {result.total} recipient{result.total !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{result.sent}</p>
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide mt-0.5">Delivered</p>
                    </div>
                    <div className={`rounded-xl px-4 py-3 text-center border ${
                      result.failed > 0
                        ? "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    }`}>
                      <p className={`text-2xl font-bold tabular-nums ${result.failed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}`}>
                        {result.failed}
                      </p>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide mt-0.5 ${result.failed > 0 ? "text-red-500 dark:text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
                        Failed
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={reset}
                    className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Send another broadcast
                  </button>
                </div>
              </div>
            ) : stage === "confirm" ? (
              /* Confirmation step */
              <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-amber-600 dark:text-amber-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      Send to {clients.length} client{clients.length !== 1 ? "s" : ""}?
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                      This action cannot be undone. Review your message below.
                    </p>
                  </div>
                </div>

                {/* Message preview */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap border border-slate-200 dark:border-slate-700 max-h-[200px] overflow-y-auto">
                  {message.trim()}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setStage("compose")}
                    disabled={sending}
                    className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 rounded-lg font-medium text-sm transition-colors"
                  >
                    Edit message
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                          <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" className="opacity-25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                        Confirm — send to {clients.length}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Compose */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Message
                    </label>
                    <span className={`text-xs tabular-nums ${message.length > 1000 ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>
                      {message.length} chars
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={9}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={"Dear clients,\n\nWe have new arrivals and updated prices available. Don't hesitate to place your order!\n\nThank you for your continued trust."}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors resize-none"
                  />
                </div>

                <button
                  onClick={() => setStage("confirm")}
                  disabled={!canSend}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white/80">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Send to {clients.length} client{clients.length !== 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>

          {/* Right — recipient list */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  Recipients
                </p>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md tabular-nums">
                  {clients.length}
                </span>
              </div>
              <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {clients.map((c) => {
                  const initials = c.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <div key={c.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${avatarColor(c.name)}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono leading-tight">
                          {c.whatsapp_number.replace(/@s\.whatsapp\.net$|@lid$/, "")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
