"use client";
import type { Order } from "@/types";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "./LanguageProvider";
import type { TKey } from "@/lib/translations";

const STATUS_CFG: Record<
  string,
  { labelKey: TKey; dot: string; pill: string; accent: string; avatarRing: string }
> = {
  pending: {
    labelKey: "status_pending",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    accent: "bg-amber-400",
    avatarRing: "ring-amber-200 dark:ring-amber-500/20",
  },
  confirmed: {
    labelKey: "status_confirmed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    accent: "bg-emerald-500",
    avatarRing: "ring-emerald-200 dark:ring-emerald-500/20",
  },
  fulfilled: {
    labelKey: "status_fulfilled",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    accent: "bg-blue-500",
    avatarRing: "ring-blue-200 dark:ring-blue-500/20",
  },
  invoiced: {
    labelKey: "status_invoiced",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    accent: "bg-slate-300 dark:bg-slate-700",
    avatarRing: "ring-slate-200 dark:ring-slate-700",
  },
};

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

export function OrderCard({ order, isNew = false }: { order: Order; isNew?: boolean }) {
  const { t } = useLanguage();
  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.invoiced;

  const diff = Date.now() - new Date(order.created_at).getTime();
  const mins = Math.floor(diff / 60000);
  let timeLabel: string;
  if (mins < 1) timeLabel = t("just_now");
  else if (mins < 60) timeLabel = t("ago_min", { n: mins });
  else if (mins < 1440) timeLabel = t("ago_hr", { n: Math.floor(mins / 60) });
  else timeLabel = t("ago_day", { n: Math.floor(mins / 1440) });

  const firstItem = order.items[0]?.product_name ?? t("no_items");
  const extraCount = order.items.length - 1;

  return (
    <Link href={`/dashboard/orders/${order.id}`} className="block">
      <div
        className={`group relative flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-[0_2px_12px_0_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_12px_0_rgba(0,0,0,0.25)] transition-all duration-150 overflow-hidden cursor-pointer ${
          isNew
            ? "border-emerald-300 dark:border-emerald-500/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        {/* Left status strip */}
        <div className={`absolute left-0 inset-y-0 w-[3px] ${cfg.accent} rounded-r-full`} />

        {/* New-order pulse overlay */}
        <AnimatePresence>
          {isNew && (
            <motion.div
              className="absolute inset-0 bg-emerald-400/5 dark:bg-emerald-400/8 pointer-events-none"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
            />
          )}
        </AnimatePresence>

        {/* Client avatar */}
        <div
          className={`ml-1.5 w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold ring-2 ${avatarColor(order.client.name)} ${cfg.avatarRing}`}
        >
          {order.client.name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {order.client.name}
            </p>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-600 flex-shrink-0">
              #{order.id}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {firstItem}
            {extraCount > 0 && (
              <span className="text-slate-400 dark:text-slate-600 font-normal">
                {" "}
                {t("more_items", { n: extraCount })}
              </span>
            )}
            <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
            {timeLabel}
            {order.delivery_date && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                <span className="text-blue-500 dark:text-blue-400">
                  {new Date(order.delivery_date + "T00:00:00").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
            {order.notes && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                <svg
                  width="9"
                  height="9"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="inline -translate-y-px text-slate-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                  />
                </svg>
              </>
            )}
          </p>
        </div>

        {/* Right: amount + status badge */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
            {order.total}
            <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 ml-1">
              {order.currency}
            </span>
          </span>

          {/* Status badge — animates when status changes */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={order.status}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" } }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.1 } }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              {t(cfg.labelKey)}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Arrow */}
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          className="flex-shrink-0 text-slate-300 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-150"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}
