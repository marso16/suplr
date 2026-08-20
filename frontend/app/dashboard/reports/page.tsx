"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { ReportsSkeleton } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import { useTheme } from "@/components/ThemeProvider";
import type { TKey } from "@/lib/translations";
import type { Report, PeriodBucket, ProductStat, ClientStat } from "@/types";

const PERIODS: { key: string; tKey: TKey }[] = [
  { key: "7d", tKey: "reports_period_7d" },
  { key: "30d", tKey: "reports_period_30d" },
  { key: "90d", tKey: "reports_period_90d" },
  { key: "1y", tKey: "reports_period_1y" },
  { key: "all", tKey: "reports_period_all" },
];

function fmt(n: string | number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = Math.floor(Math.log10(v));
  const factor = Math.pow(10, exp);
  return Math.ceil(v / factor) * factor;
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-500 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight leading-none">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Area Chart ────────────────────────────────────────────────────────────────
const VW = 800;
const VH = 210;
const PAD = { t: 12, r: 16, b: 40, l: 54 };
const IW = VW - PAD.l - PAD.r;
const IH = VH - PAD.t - PAD.b;

function AreaChart({
  buckets,
  isDark,
}: {
  buckets: PeriodBucket[];
  isDark: boolean;
}) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  if (buckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-400 dark:text-slate-600 text-sm">
        {t("reports_no_data_period")}
      </div>
    );
  }

  const n = buckets.length;
  const values = buckets.map((b) => Number(b.revenue));
  const rawMax = Math.max(...values, 1);
  const maxVal = niceMax(rawMax);

  const xOf = (i: number) =>
    PAD.l + (n > 1 ? i / (n - 1) : 0.5) * IW;
  const yOf = (v: number) =>
    PAD.t + IH - Math.min(v / maxVal, 1) * IH;

  const pts = buckets.map((b, i) => ({
    x: xOf(i),
    y: yOf(Number(b.revenue)),
    label: b.label,
    revenue: Number(b.revenue),
    orders: b.order_count,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${pts[n - 1].x.toFixed(1)},${(PAD.t + IH).toFixed(1)} L${PAD.l},${(PAD.t + IH).toFixed(1)} Z`;

  // y-axis ticks: 0, 25, 50, 75, 100% of maxVal
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    v: maxVal * pct,
    y: yOf(maxVal * pct),
  }));

  // x-axis labels: show max 8, always include first and last
  const labelStep = Math.max(1, Math.ceil(n / 8));
  const showLabel = (i: number) => i === 0 || i === n - 1 || i % labelStep === 0;

  const emerald = isDark ? "#34d399" : "#10b981";
  const gridStroke = isDark ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.18)";
  const axisText = isDark ? "#475569" : "#94a3b8";
  const surface = isDark ? "#0f172a" : "#ffffff";

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;
    const svgRect = svg.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const svgX = ((e.clientX - svgRect.left) / svgRect.width) * VW;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    });
    setHoverIdx(nearestIdx);
    setTipPos({
      x: e.clientX - contRect.left,
      y: e.clientY - contRect.top,
    });
  }

  const hovered = hoverIdx !== null ? pts[hoverIdx] : null;
  const containerWidth = containerRef.current?.offsetWidth ?? VW;

  return (
    <div ref={containerRef} className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        style={{ height: VH, overflow: "visible" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y gridlines + labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line
              x1={PAD.l}
              y1={y}
              x2={VW - PAD.r}
              y2={y}
              stroke={gridStroke}
              strokeWidth={1}
            />
            <text
              x={PAD.l - 6}
              y={y + 4}
              textAnchor="end"
              fill={axisText}
              fontSize={10}
              fontFamily="ui-monospace,SFMono-Regular,monospace"
            >
              {fmtShort(v)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={emerald}
          fillOpacity={isDark ? 0.1 : 0.07}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={emerald}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair */}
        {hovered && (
          <line
            x1={hovered.x}
            y1={PAD.t}
            x2={hovered.x}
            y2={PAD.t + IH}
            stroke={gridStroke}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Dots */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 5 : 3.5}
            fill={emerald}
            stroke={surface}
            strokeWidth={2}
            style={{ transition: "r 0.1s" }}
          />
        ))}

        {/* X axis labels */}
        {pts.map((p, i) =>
          showLabel(i) ? (
            <text
              key={i}
              x={p.x}
              y={VH - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fill={axisText}
              fontSize={10}
              fontFamily="system-ui,sans-serif"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-20 pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs whitespace-nowrap"
          style={{
            left:
              tipPos.x > containerWidth / 2
                ? tipPos.x - 8
                : tipPos.x + 12,
            top: Math.max(tipPos.y - 68, 4),
            transform:
              tipPos.x > containerWidth / 2
                ? "translateX(-100%)"
                : "none",
          }}
        >
          <p className="text-slate-400 dark:text-slate-500 mb-1 font-medium">
            {hovered.label}
          </p>
          <p className="text-slate-900 dark:text-slate-100 font-mono font-bold text-sm">
            {fmt(hovered.revenue)}
          </p>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            {t("reports_orders_n", { n: hovered.orders })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Horizontal Bar List ───────────────────────────────────────────────────────
function HBarList({ items, showBalance }: { items: (ProductStat | ClientStat)[]; showBalance?: boolean }) {
  const { t } = useLanguage();
  const maxVal = Math.max(...items.map((it) => Number(it.revenue)), 1);

  return (
    <div className="space-y-3.5 mt-3">
      {items.map((item, i) => {
        const pct = (Number(item.revenue) / maxVal) * 100;
        const balance = showBalance && "credit_balance" in item ? Number(item.credit_balance) : 0;
        const hasBalance = balance > 0;
        return (
          <div key={item.name}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium truncate leading-none">
                  {item.name}
                </span>
                {hasBalance && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">
                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${balance.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  {t("reports_orders_n", { n: item.order_count })}
                </span>
                <span className="text-[13px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {fmt(item.revenue)}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: hasBalance
                    ? `rgba(239,68,68,${0.7 - i * 0.05})`
                    : `rgba(16,185,129,${1 - i * 0.08})`,
                  transition: `width 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<string>("30d");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { isDark } = useTheme();

  useEffect(() => {
    setLoading(true);
    api.reports
      .get(period)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [period]);

  const bestBucket =
    report && report.buckets.length > 0
      ? report.buckets.reduce((best, b) =>
          Number(b.revenue) > Number(best.revenue) ? b : best,
          report.buckets[0]
        )
      : null;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t("nav_reports")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("reports_subtitle")}
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                period === p.key
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {t(p.tKey)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ReportsSkeleton />
      ) : !report ? null : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiTile
              label={t("reports_kpi_revenue")}
              value={fmt(report.revenue)}
              sub={t("reports_settled", { n: report.order_count })}
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <KpiTile
              label={t("orders_title")}
              value={String(report.order_count)}
              sub={
                report.order_count > 0
                  ? `avg ${fmt(report.avg_order_value)} each`
                  : t("reports_no_settled")
              }
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              }
            />
            <KpiTile
              label={t("reports_kpi_avg")}
              value={fmt(report.avg_order_value)}
              sub={t("reports_per_settled")}
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
              }
            />
            <KpiTile
              label={t("reports_kpi_peak")}
              value={bestBucket ? fmtShort(Number(bestBucket.revenue)) : "—"}
              sub={
                bestBucket
                  ? t("reports_peak_sub", {
                      label: bestBucket.label,
                      n: bestBucket.order_count,
                    })
                  : t("reports_no_data")
              }
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              }
            />
          </div>

          {/* Revenue over time */}
          {report.buckets.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 pt-4 pb-3 mb-4">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                {t("reports_revenue_time")}
              </p>
              <AreaChart buckets={report.buckets} isDark={isDark} />
            </div>
          )}

          {/* Top products + top clients */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("reports_top_products")}
              </p>
              {report.top_products.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
                  {t("reports_no_data")}
                </p>
              ) : (
                <HBarList items={report.top_products} />
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("reports_top_clients")}
              </p>
              {report.top_clients.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
                  {t("reports_no_data")}
                </p>
              ) : (
                <HBarList items={report.top_clients} showBalance />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
