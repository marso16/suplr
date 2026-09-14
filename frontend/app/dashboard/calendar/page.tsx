"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import { RefreshButton } from "@/components/RefreshButton";
import type { Order } from "@/types";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  fulfilled: "bg-blue-500",
  invoiced: "bg-slate-400",
};

const STATUS_PILL: Record<string, string> = {
  pending:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  confirmed:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  fulfilled:
    "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  invoiced:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

function toLocalDate(iso: string) {
  // treat delivery_date as local date (no timezone shift)
  return new Date(iso + "T00:00:00");
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadOrders() {
    const data = await api.orders.list();
    setOrders(data);
  }

  useEffect(() => {
    loadOrders().finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );

  const today = dayKey(new Date());

  // Only orders with a delivery_date that are not yet invoiced
  const withDate = orders
    .filter((o) => o.delivery_date && o.status !== "invoiced")
    .sort((a, b) => a.delivery_date!.localeCompare(b.delivery_date!));

  // Group by date
  const groups = new Map<string, Order[]>();
  for (const o of withDate) {
    const key = o.delivery_date!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const overdueEntries = [...groups.entries()].filter(([k]) => k < today);
  const todayEntries = [...groups.entries()].filter(([k]) => k === today);
  const upcomingEntries = [...groups.entries()].filter(([k]) => k > today);

  function Section({
    label,
    accent,
    entries,
  }: {
    label: string;
    accent: string;
    entries: [string, Order[]][];
  }) {
    if (entries.length === 0) return null;
    return (
      <div className="mb-8">
        <div className={`flex items-center gap-2 mb-3`}>
          <span
            className={`text-xs font-bold uppercase tracking-widest ${accent}`}
          >
            {label}
          </span>
          <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="space-y-6">
          {entries.map(([date, dayOrders]) => {
            const d = toLocalDate(date);
            const isToday = date === today;
            const isOverdue = date < today;
            return (
              <div key={date}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span
                    className={`text-sm font-semibold ${
                      isToday
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isOverdue
                          ? "text-red-500 dark:text-red-400"
                          : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {d.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-600 tabular-nums">
                    {dayOrders.length} order{dayOrders.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {dayOrders.map((o) => (
                    <Link
                      key={o.id}
                      href={`/dashboard/orders/${o.id}`}
                      className="group flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-150"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[o.status] ?? "bg-slate-400"}`}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {o.client.name}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate block">
                          {o.items[0]?.product_name ?? "—"}
                          {o.items.length > 1 && ` +${o.items.length - 1}`}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[o.status]}`}
                        >
                          {o.status}
                        </span>
                        <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {o.total}
                          <span className="text-xs font-normal text-slate-400 ml-0.5">
                            {o.currency}
                          </span>
                        </span>
                        <svg
                          width="13"
                          height="13"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="text-slate-300 dark:text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t("cal_title")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("cal_subtitle")}
          </p>
        </div>
        <RefreshButton
          loading={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await loadOrders();
            setRefreshing(false);
          }}
        />
      </div>

      {withDate.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <svg
            width="40"
            height="40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.25}
            className="text-slate-300 dark:text-slate-700 mb-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t("cal_no_deliveries")}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 max-w-xs">
            {t("cal_no_deliveries_sub")}
          </p>
        </div>
      ) : (
        <>
          <Section
            label={t("cal_overdue")}
            accent="text-red-500 dark:text-red-400"
            entries={overdueEntries}
          />
          <Section
            label={t("cal_today")}
            accent="text-emerald-600 dark:text-emerald-400"
            entries={todayEntries}
          />
          <Section
            label={t("cal_upcoming")}
            accent="text-slate-500 dark:text-slate-400"
            entries={upcomingEntries}
          />
        </>
      )}
    </div>
  );
}
