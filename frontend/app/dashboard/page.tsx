"use client";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import { useOrderWS } from "@/lib/ws";
import { OrderCard } from "@/components/OrderCard";
import { OrdersSkeleton } from "@/components/Spinner";
import { ToastList, type ToastItem } from "@/components/Toast";
import { EmptyState, InboxIllustration } from "@/components/EmptyState";
import { useLanguage } from "@/components/LanguageProvider";
import { RefreshButton } from "@/components/RefreshButton";
import type { Order, OrderStatus, SSEOrderEvent } from "@/types";
import type { TKey } from "@/lib/translations";

const TABS: { key: TKey; value: OrderStatus | "all" }[] = [
  { key: "tab_all", value: "all" },
  { key: "tab_pending", value: "pending" },
  { key: "tab_confirmed", value: "confirmed" },
  { key: "tab_fulfilled", value: "fulfilled" },
  { key: "tab_invoiced", value: "invoiced" },
];

const TAB_ACTIVE_TEXT: Record<string, string> = {
  all: "text-slate-900 dark:text-slate-100",
  pending: "text-amber-600 dark:text-amber-400",
  confirmed: "text-emerald-600 dark:text-emerald-400",
  fulfilled: "text-blue-600 dark:text-blue-400",
  invoiced: "text-slate-600 dark:text-slate-400",
};
const TAB_ACTIVE_BORDER: Record<string, string> = {
  all: "border-slate-900 dark:border-slate-300",
  pending: "border-amber-500",
  confirmed: "border-emerald-500",
  fulfilled: "border-blue-500",
  invoiced: "border-slate-400",
};

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
  const newOrderTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOp, setBulkOp] = useState<"confirm" | "fulfill" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  useOrderWS(
    useCallback(
      (event: SSEOrderEvent) => {
        loadOrders();
        if (event.type === "order_created") {
          const id = event.order_id;

          // Mark order as new — clears after 3s
          setNewOrderIds((prev) => new Set(Array.from(prev).concat(id)));
          const timer = setTimeout(() => {
            setNewOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            newOrderTimers.current.delete(id);
          }, 3000);
          newOrderTimers.current.set(id, timer);

          api.orders
            .get(id)
            .then((order) => {
              addToast({
                id: `${id}-${Date.now()}`,
                title: `New order from ${order.client.name}`,
                sub: `${order.items.length} item${order.items.length !== 1 ? "s" : ""} · ${order.total} ${order.currency}`,
              });
            })
            .catch(() => {});
        }
      },
      [loadOrders],
    ),
  );

  // Clean up timers on unmount
  useEffect(() => {
    const timers = newOrderTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkConfirm() {
    const ids = [...selected].filter(
      (id) => orders.find((o) => o.id === id)?.status === "pending",
    );
    if (!ids.length) return;
    setBulkOp("confirm");
    await Promise.allSettled(ids.map((id) => api.orders.confirm(id)));
    await loadOrders();
    setSelected(new Set());
    setBulkOp(null);
  }

  async function runBulkFulfill() {
    const ids = [...selected].filter(
      (id) => orders.find((o) => o.id === id)?.status === "confirmed",
    );
    if (!ids.length) return;
    setBulkOp("fulfill");
    await Promise.allSettled(ids.map((id) => api.orders.fulfill(id)));
    await loadOrders();
    setSelected(new Set());
    setBulkOp(null);
  }

  const q = search.trim().toLowerCase();
  const byTab = tab === "all" ? orders : orders.filter((o) => o.status === tab);
  const filtered = q
    ? byTab.filter(
        (o) =>
          o.client.name.toLowerCase().includes(q) ||
          String(o.id).includes(q),
      )
    : byTab;
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const selectedPending = [...selected].filter(
    (id) => orders.find((o) => o.id === id)?.status === "pending",
  ).length;
  const selectedConfirmed = [...selected].filter(
    (id) => orders.find((o) => o.id === id)?.status === "confirmed",
  ).length;

  const rm = !!shouldReduceMotion;

  if (loading) return <OrdersSkeleton />;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-5 flex-shrink-0 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t("orders_title")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("orders_total", { n: orders.length })}
            {pendingCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {t("orders_pending", { n: pendingCount })}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <RefreshButton
            loading={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await loadOrders();
              setRefreshing(false);
            }}
          />

        {orders.length > 0 && (
          <button
            onClick={() => {
              const token = localStorage.getItem("token");
              const url = `${BASE}/orders/export${token ? `?token=${token}` : ""}`;
              const a = document.createElement("a");
              a.href = url;
              a.click();
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 px-3.5 py-2 transition-colors flex-shrink-0 cursor-pointer"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
        )}
        </div>
      </div>

      {/* Underline tabs */}
      <div className="flex overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800/80 flex-shrink-0">
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
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${
                active
                  ? `${TAB_ACTIVE_TEXT[tab_item.value]} ${TAB_ACTIVE_BORDER[tab_item.value]}`
                  : "text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {t(tab_item.key)}
              {count > 0 && (
                <span
                  className={`text-[10px] font-semibold tabular-nums ${
                    active
                      ? "opacity-70"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-4 sm:px-6 lg:px-8 pb-4 flex-shrink-0">
        <div className="relative">
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("orders_search")}
            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-8 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg
                width="13"
                height="13"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Pending callout */}
        {tab === "all" && pendingCount > 0 && (
          <button
            onClick={() => setTab("pending")}
            className="w-full mb-3 flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-500/[0.08] border-l-2 border-amber-400 text-left hover:bg-amber-100/70 dark:hover:bg-amber-500/12 transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex-1">
              {t("orders_pending", { n: pendingCount })}
            </span>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-amber-500 dark:text-amber-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* Order list */}
        {filtered.length === 0 ? (
          <EmptyState
            illustration={<InboxIllustration />}
            title={t("orders_empty")}
          />
        ) : (
          // key={tab} remounts the list on tab switch so stagger re-fires
          <div key={tab} className="border-t border-slate-100 dark:border-slate-800/80">
            {filtered.map((o, i) => {
              const isNew = newOrderIds.has(o.id);
              const isSelectable = o.status === "pending" || o.status === "confirmed";
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: rm ? 0 : isNew ? -10 : 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: rm ? 0 : isNew ? 0.28 : 0.18,
                    delay: rm ? 0 : isNew ? 0 : Math.min(i * 0.045, 0.35),
                    ease: isNew ? [0.22, 1, 0.36, 1] : "easeOut",
                  }}
                >
                  <OrderCard
                    order={o}
                    isNew={isNew}
                    selected={selected.has(o.id)}
                    onSelect={isSelectable ? () => toggleSelect(o.id) : undefined}
                  />
                </motion.div>
              );
            })}
          </div>
        )}

        <ToastList toasts={toasts} onDismiss={dismissToast} />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-slate-900 dark:bg-slate-800 border border-slate-700 dark:border-slate-600">
            <span className="text-sm font-medium text-white flex-shrink-0">
              {t("bulk_selected", { n: selected.size })}
            </span>
            <span className="flex-1" />
            {selectedPending > 0 && (
              <button
                onClick={runBulkConfirm}
                disabled={bulkOp !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {bulkOp === "confirm" ? t("bulk_confirming") : `${t("bulk_confirm")} (${selectedPending})`}
              </button>
            )}
            {selectedConfirmed > 0 && (
              <button
                onClick={runBulkFulfill}
                disabled={bulkOp !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {bulkOp === "fulfill" ? t("bulk_fulfilling") : `${t("bulk_fulfill")} (${selectedConfirmed})`}
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              disabled={bulkOp !== null}
              className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              {t("bulk_clear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
