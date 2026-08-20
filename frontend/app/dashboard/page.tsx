"use client";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useOrderSSE } from "@/lib/sse";
import { OrderCard } from "@/components/OrderCard";
import { OrdersSkeleton } from "@/components/Spinner";
import { ToastList, type ToastItem } from "@/components/Toast";
import { EmptyState, InboxIllustration } from "@/components/EmptyState";
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
  all: "bg-slate-900 text-white dark:bg-slate-600 dark:text-white",
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function addToast(toast: ToastItem) {
    setToasts((prev) => [...prev, toast]);
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

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
      (event: SSEOrderEvent) => {
        loadOrders();
        if (event.type === "order_created") {
          api.orders.get(event.order_id).then((order) => {
            addToast({
              id: `${event.order_id}-${Date.now()}`,
              title: `New order from ${order.client.name}`,
              sub: `${order.items.length} item${order.items.length !== 1 ? "s" : ""} · ${order.total} ${order.currency}`,
            });
          }).catch(() => {});
        }
      },
      [loadOrders],
    ),
  );

  const filtered =
    tab === "all" ? orders : orders.filter((o) => o.status === tab);
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  if (loading) return <OrdersSkeleton />;

  return (
    <div className="h-full flex flex-col">
      {/* Header — pinned */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-5 flex-shrink-0 flex items-start justify-between gap-4">
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

      {/* Pill tabs — pinned */}
      <div className="flex gap-1.5 mb-0 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 pb-4 flex-shrink-0">
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
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
        <EmptyState illustration={<InboxIllustration />} title={t("orders_empty")} />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}

      <ToastList toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}
