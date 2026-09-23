"use client";
import type { Order } from "@/types";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "./LanguageProvider";
import type { TKey } from "@/lib/translations";

const STATUS_CFG: Record<
  string,
  {
    labelKey: TKey;
    label: string;
    accent: string;
    avatarBg: string;
  }
> = {
  pending: {
    labelKey: "status_pending",
    label: "text-amber-600 dark:text-amber-400",
    accent: "bg-amber-400",
    avatarBg: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  confirmed: {
    labelKey: "status_confirmed",
    label: "text-emerald-600 dark:text-emerald-400",
    accent: "bg-emerald-500",
    avatarBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  fulfilled: {
    labelKey: "status_fulfilled",
    label: "text-blue-600 dark:text-blue-400",
    accent: "bg-blue-500",
    avatarBg: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  invoiced: {
    labelKey: "status_invoiced",
    label: "text-slate-500 dark:text-slate-400",
    accent: "bg-slate-300 dark:bg-slate-700",
    avatarBg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};


export function OrderCard({
  order,
  isNew = false,
  selected = false,
  onSelect,
}: {
  order: Order;
  isNew?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
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
    <div className="relative">
      {/* Checkbox */}
      {onSelect && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect();
          }}
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 flex items-center justify-center border transition-colors cursor-pointer ${
            selected
              ? "bg-emerald-500 border-emerald-500"
              : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600 hover:border-emerald-400"
          }`}
          aria-label="Select order"
        >
          {selected && (
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}
    <Link href={`/dashboard/orders/${order.id}`} className="block">
      <div
        className={`group relative flex items-center gap-3 sm:gap-4 py-3.5 bg-white dark:bg-slate-950 border-b transition-colors duration-100 cursor-pointer overflow-hidden ${
          onSelect ? "pl-10 pr-4 sm:pr-5" : "px-4 sm:px-5"
        } ${
          selected
            ? "bg-emerald-50/60 dark:bg-emerald-500/[0.06] border-slate-200 dark:border-slate-800"
            : isNew
              ? "bg-emerald-50/40 dark:bg-emerald-500/[0.04] border-slate-200 dark:border-slate-800"
              : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900"
        }`}
      >
        {/* Left status strip */}
        <div className={`absolute left-0 inset-y-0 w-[2px] ${cfg.accent}`} />

        {/* New-order flash */}
        <AnimatePresence>
          {isNew && (
            <motion.div
              className="absolute inset-0 bg-emerald-400/5 dark:bg-emerald-400/6 pointer-events-none"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.8 } }}
            />
          )}
        </AnimatePresence>

        {/* Client monogram — square */}
        <div
          className={`ml-1 w-8 h-8 flex-shrink-0 flex items-center justify-center text-[12px] font-bold tracking-tight ${cfg.avatarBg}`}
        >
          {order.client.name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {order.client.name}
            </p>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 flex-shrink-0">
              #{order.id}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {firstItem}
            {extraCount > 0 && (
              <span className="text-slate-400 dark:text-slate-600">
                {" "}{t("more_items", { n: extraCount })}
              </span>
            )}
            <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
            {timeLabel}
            {order.delivery_date && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                <span className="text-blue-500 dark:text-blue-400">
                  {new Date(order.delivery_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </>
            )}
            {order.notes && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="inline -translate-y-px text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </>
            )}
          </p>
        </div>

        {/* Right: amount + status label */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
            {order.total}
            <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 ml-1">{order.currency}</span>
          </span>

          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={order.status}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.12, ease: "easeOut" } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.label}`}
            >
              {t(cfg.labelKey)}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Arrow */}
        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          className="flex-shrink-0 text-slate-300 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-100"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
    </div>
  );
}
