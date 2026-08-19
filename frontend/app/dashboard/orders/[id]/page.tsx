"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { TKey } from "@/lib/translations";
import type { Order } from "@/types";

const STATUS_CFG: Record<string, { labelKey: TKey; dot: string; pill: string; accent: string }> = {
  pending: {
    labelKey: "status_pending",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    accent: "from-amber-500/10 to-transparent",
  },
  confirmed: {
    labelKey: "status_confirmed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    accent: "from-emerald-500/10 to-transparent",
  },
  fulfilled: {
    labelKey: "status_fulfilled",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    accent: "from-blue-500/10 to-transparent",
  },
  invoiced: {
    labelKey: "status_invoiced",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    accent: "from-slate-400/10 to-transparent",
  },
};

function MiniSpinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin text-slate-400 flex-shrink-0">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    api.orders.get(Number(id)).then(setOrder).catch(() => router.push("/dashboard"));
  }, [id, router]);

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.invoiced;

  async function confirm() {
    setLoading(true);
    try { setOrder(await api.orders.confirm(order!.id)); } finally { setLoading(false); }
  }
  async function fulfill() {
    setLoading(true);
    try { setOrder(await api.orders.fulfill(order!.id)); } finally { setLoading(false); }
  }
  async function invoice() {
    setLoading(true);
    try { await api.invoices.create(order!.id); router.push("/dashboard"); } finally { setLoading(false); }
  }
  async function handleDeliveryDate(value: string) {
    setSavingDate(true);
    try { setOrder(await api.orders.setDeliveryDate(order!.id, value || null)); } finally { setSavingDate(false); }
  }
  async function handleNotes(value: string) {
    setSavingNotes(true);
    try { setOrder(await api.orders.setNotes(order!.id, value.trim() || null)); } finally { setSavingNotes(false); }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mb-6 transition-colors group"
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="rtl:rotate-180 group-hover:-translate-x-0.5 transition-transform">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t("back")}
      </button>

      {/* Header */}
      <div className={`bg-gradient-to-r ${cfg.accent} rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-4 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {t("order_detail")}
              </h1>
              <span className="font-mono text-sm font-semibold text-slate-400 dark:text-slate-500">
                #{order.id}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {order.client.name}
            </p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${cfg.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
          {t(cfg.labelKey)}
        </span>
      </div>

      {/* Meta card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-2 divide-y divide-slate-100 dark:divide-slate-800">
          {/* Client */}
          <div className="col-span-2 sm:col-span-1 px-5 py-4 border-b border-slate-100 dark:border-slate-800 sm:border-b-0 sm:border-r sm:border-slate-100 sm:dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {t("meta_client")}
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{order.client.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
              {order.client.whatsapp_number.replace(/@s\.whatsapp\.net$|@lid$/, "")}
            </p>
          </div>

          {/* Created */}
          <div className="col-span-2 sm:col-span-1 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t("meta_created")}
            </p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>

          {/* Currency + items */}
          <div className="px-5 py-4 border-r border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">{t("meta_currency")}</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold font-mono border border-slate-200 dark:border-slate-700">
              {order.currency}
            </span>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">{t("meta_items")}</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{order.items.length}</p>
          </div>

          {/* Delivery date */}
          <div className="col-span-2 px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {t("meta_delivery")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                defaultValue={order.delivery_date ?? ""}
                onBlur={(e) => handleDeliveryDate(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
              />
              {savingDate && <MiniSpinner />}
            </div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_product")}</th>
              <th className="text-end px-4 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_qty")}</th>
              <th className="text-end px-4 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_unit")}</th>
              <th className="text-end px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_price")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {order.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{item.product_name}</td>
                <td className="px-4 py-3.5 text-end font-mono text-slate-600 dark:text-slate-400 tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3.5 text-end text-slate-500 dark:text-slate-400">{item.unit}</td>
                <td className="px-5 py-3.5 text-end font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{item.price}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <td colSpan={3} className="px-5 py-3.5 text-sm font-semibold text-slate-500 dark:text-slate-400 text-end">{t("col_total")}</td>
              <td className="px-5 py-3.5 text-end font-mono font-bold text-lg text-slate-900 dark:text-slate-100 tabular-nums">
                {order.total}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">{order.currency}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-5">
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
          {t("meta_notes")}
          {savingNotes && <MiniSpinner />}
        </p>
        <textarea
          rows={3}
          defaultValue={order.notes ?? ""}
          placeholder="Special instructions, delivery notes…"
          onBlur={(e) => handleNotes(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors resize-none"
        />
      </div>

      {/* Actions */}
      {order.status !== "invoiced" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Next step</p>
          {order.status === "pending" && (
            <button
              onClick={confirm}
              disabled={loading}
              className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {t("btn_confirm_order")}
            </button>
          )}
          {order.status === "confirmed" && (
            <button
              onClick={fulfill}
              disabled={loading}
              className="flex items-center gap-2.5 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              {t("btn_fulfill")}
            </button>
          )}
          {order.status === "fulfilled" && (
            <button
              onClick={invoice}
              disabled={loading}
              className="flex items-center gap-2.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {t("btn_generate_invoice")}
            </button>
          )}
        </div>
      )}

      {order.status === "invoiced" && (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t("invoice_generated")}
        </div>
      )}
    </div>
  );
}
