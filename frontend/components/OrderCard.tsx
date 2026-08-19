"use client";
import type { Order } from "@/types";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import type { TKey } from "@/lib/translations";

const statusKeys: Record<string, { labelKey: TKey; dot: string; pill: string }> = {
  pending:   { labelKey: "status_pending",   dot: "bg-amber-400",   pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  confirmed: { labelKey: "status_confirmed", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  fulfilled: { labelKey: "status_fulfilled", dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  invoiced:  { labelKey: "status_invoiced",  dot: "bg-slate-400",   pill: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
};

export function OrderCard({ order }: { order: Order }) {
  const { t } = useLanguage();
  const cfg = statusKeys[order.status] ?? statusKeys.invoiced;

  const diff = Date.now() - new Date(order.created_at).getTime();
  const mins = Math.floor(diff / 60000);
  let timeLabel: string;
  if (mins < 1) timeLabel = t("just_now");
  else if (mins < 60) timeLabel = t("ago_min", { n: mins });
  else if (mins < 1440) timeLabel = t("ago_hr", { n: Math.floor(mins / 60) });
  else timeLabel = t("ago_day", { n: Math.floor(mins / 1440) });

  return (
    <Link href={`/dashboard/orders/${order.id}`}>
      <div className="group flex items-center gap-4 px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-emerald-500/40 dark:hover:border-emerald-500/30 hover:shadow-sm transition-all cursor-pointer">
        <div className="w-10 flex-shrink-0 text-right">
          <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">#{order.id}</span>
        </div>
        <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {order.items[0]?.product_name ?? t("no_items")}
            {order.items.length > 1 && (
              <span className="text-slate-400 dark:text-slate-500 font-normal"> {t("more_items", { n: order.items.length - 1 })}</span>
            )}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{order.client.name}</span>
            <span className="mx-1.5">·</span>
            {timeLabel}
            {order.delivery_date && (
              <>
                <span className="mx-1.5">·</span>
                <span className="text-blue-500 dark:text-blue-400">
                  {new Date(order.delivery_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </>
            )}
            {order.notes && (
              <>
                <span className="mx-1.5">·</span>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="inline text-slate-400 dark:text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </>
            )}
          </p>
        </div>
        <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">
          {order.total}{" "}
          <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">{order.currency}</span>
        </span>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${cfg.pill}`}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
          {t(cfg.labelKey)}
        </div>
      </div>
    </Link>
  );
}
