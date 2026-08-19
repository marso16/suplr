"use client";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useOrderSSE } from "@/lib/sse";
import { OrderCard } from "@/components/OrderCard";
import { LoadingScreen } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Order, OrderStatus, SSEOrderEvent } from "@/types";
import type { TKey } from "@/lib/translations";

const TABS: { key: TKey; value: OrderStatus | "all" }[] = [
  { key: "tab_all", value: "all" },
  { key: "tab_pending", value: "pending" },
  { key: "tab_confirmed", value: "confirmed" },
  { key: "tab_fulfilled", value: "fulfilled" },
  { key: "tab_invoiced", value: "invoiced" },
];

const TAB_ACTIVE: Record<string, string> = {
  all: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
  pending: "bg-amber-500 text-white",
  confirmed: "bg-emerald-500 text-white",
  fulfilled: "bg-blue-500 text-white",
  invoiced: "bg-slate-500 text-white",
};

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus | "all">("all");

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.orders.list();
      setOrders(data);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useOrderSSE(
    useCallback(
      (_event: SSEOrderEvent) => {
        loadOrders();
      },
      [loadOrders],
    ),
  );

  const filtered =
    tab === "all" ? orders : orders.filter((o) => o.status === tab);
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t("orders_title")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("orders_total", { n: orders.length })}
            {pendingCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {t("orders_pending", { n: pendingCount })}
                </span>
              </>
            )}
          </p>
        </div>

        {orders.length > 0 && (
          <button
            onClick={() => {
              const token = localStorage.getItem("token");
              const url = `${BASE}/orders/export${token ? `?token=${token}` : ""}`;
              const a = document.createElement("a");
              a.href = url;
              a.click();
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 px-3.5 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
        )}
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 pb-0.5">
        {TABS.map((tab_item) => {
          const count =
            tab_item.value === "all"
              ? orders.length
              : orders.filter((o) => o.status === tab_item.value).length;
          const active = tab === tab_item.value;
          return (
            <button
              key={tab_item.value}
              onClick={() => setTab(tab_item.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? TAB_ACTIVE[tab_item.value]
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t(tab_item.key)}
              {count > 0 && (
                <span
                  className={`text-[11px] font-bold rounded-full px-1.5 py-px leading-none ${
                    active
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pending callout */}
      {tab === "all" && pendingCount > 0 && (
        <button
          onClick={() => setTab("pending")}
          className="w-full mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-left hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors"
        >
          <span className="relative flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex" />
            <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
          </span>
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
            {t("orders_pending", { n: pendingCount })}
          </span>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-amber-500 dark:text-amber-400 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("orders_empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
