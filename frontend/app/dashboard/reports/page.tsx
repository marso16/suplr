"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Report } from "@/types";

const PERIODS = [
  { key: "7d",  label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "1y",  label: "1 Year" },
  { key: "all", label: "All Time" },
] as const;

function fmt(n: string | number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-5">
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, sub }: { label: string; value: number; max: number; sub: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 text-xs text-slate-500 dark:text-slate-400 text-end flex-shrink-0 font-mono">{label}</span>
      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-500/80 dark:bg-emerald-500/60 rounded transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-24 text-xs font-mono text-slate-700 dark:text-slate-300 text-end flex-shrink-0">{sub}</span>
    </div>
  );
}

function RankRow({
  rank,
  name,
  revenue,
  orders,
}: {
  rank: number;
  name: string;
  revenue: string;
  orders: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800 first:border-0">
      <span className="w-5 text-xs font-bold text-slate-300 dark:text-slate-600 text-center flex-shrink-0">{rank}</span>
      <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">{name}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{orders} order{orders !== 1 ? "s" : ""}</span>
      <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300 flex-shrink-0 w-24 text-end">{fmt(revenue)}</span>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>("30d");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    setLoading(true);
    api.reports.get(period).then(setReport).finally(() => setLoading(false));
  }, [period]);

  const maxBucket = report
    ? Math.max(...report.buckets.map((b) => Number(b.revenue)), 1)
    : 1;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("nav_reports")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Revenue, top products &amp; clients</p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.key
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : !report ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Total Revenue"
              value={fmt(report.revenue)}
              sub="across confirmed & fulfilled orders"
            />
            <KpiCard
              label="Orders"
              value={String(report.order_count)}
            />
            <KpiCard
              label="Avg Order Value"
              value={fmt(report.avg_order_value)}
            />
          </div>

          {/* Revenue over time */}
          {report.buckets.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-5 mb-6">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Revenue Over Time</p>
              {report.buckets.map((b) => (
                <BarRow
                  key={b.label}
                  label={b.label}
                  value={Number(b.revenue)}
                  max={maxBucket}
                  sub={`${fmt(b.revenue)} (${b.order_count})`}
                />
              ))}
            </div>
          )}

          {/* Top lists */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top products */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-5">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Top Products</p>
              {report.top_products.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No data</p>
              ) : (
                report.top_products.map((p, i) => (
                  <RankRow
                    key={p.name}
                    rank={i + 1}
                    name={p.name}
                    revenue={p.revenue}
                    orders={p.order_count}
                  />
                ))
              )}
            </div>

            {/* Top clients */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-5">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Top Clients</p>
              {report.top_clients.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No data</p>
              ) : (
                report.top_clients.map((c, i) => (
                  <RankRow
                    key={c.name}
                    rank={i + 1}
                    name={c.name}
                    revenue={c.revenue}
                    orders={c.order_count}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
