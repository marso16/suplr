"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { TKey } from "@/lib/translations";
import type { Order } from "@/types";

const statusKeys: Record<
  string,
  { labelKey: TKey; dot: string; pill: string }
> = {
  pending: {
    labelKey: "status_pending",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  confirmed: {
    labelKey: "status_confirmed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  fulfilled: {
    labelKey: "status_fulfilled",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  },
  invoiced: {
    labelKey: "status_invoiced",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  },
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    api.orders
      .get(Number(id))
      .then(setOrder)
      .catch(() => router.push("/dashboard"));
  }, [id, router]);

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const cfg = statusKeys[order.status] ?? statusKeys.invoiced;

  async function confirm() {
    setLoading(true);
    try {
      setOrder(await api.orders.confirm(order!.id));
    } finally {
      setLoading(false);
    }
  }

  async function fulfill() {
    setLoading(true);
    try {
      setOrder(await api.orders.fulfill(order!.id));
    } finally {
      setLoading(false);
    }
  }

  async function invoice() {
    setLoading(true);
    try {
      await api.invoices.create(order!.id);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeliveryDate(value: string) {
    if (!order) return;
    setSavingDate(true);
    try {
      const updated = await api.orders.setDeliveryDate(order.id, value || null);
      setOrder(updated);
    } finally {
      setSavingDate(false);
    }
  }

  async function handleNotes(value: string) {
    if (!order) return;
    setSavingNotes(true);
    try {
      const updated = await api.orders.setNotes(order.id, value.trim() || null);
      setOrder(updated);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mb-6 transition-colors"
      >
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          className="rtl:rotate-180"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        {t("back")}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="font-mono text-sm font-semibold text-slate-400 dark:text-slate-500">
          #{order.id}
        </span>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t("order_detail")}
        </h1>
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.pill}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {t(cfg.labelKey)}
        </span>
      </div>

      {/* Meta */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {t("meta_client")}
          </p>
          <p className="text-slate-800 dark:text-slate-200 font-medium">
            {order.client.name}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
            {order.client.whatsapp_number.replace(
              /@s\.whatsapp\.net$|@lid$/,
              "",
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {t("meta_created")}
          </p>
          <p className="text-slate-800 dark:text-slate-200 font-mono text-[13px]">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        {order.confirmed_at && (
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
              {t("meta_confirmed")}
            </p>
            <p className="text-slate-800 dark:text-slate-200 font-mono text-[13px]">
              {new Date(order.confirmed_at).toLocaleString()}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {t("meta_currency")}
          </p>
          <p className="text-slate-800 dark:text-slate-200 font-medium">
            {order.currency}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {t("meta_items")}
          </p>
          <p className="text-slate-800 dark:text-slate-200 font-medium">
            {order.items.length}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
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
            {savingDate && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="animate-spin text-slate-400"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="opacity-25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("col_product")}
              </th>
              <th className="text-end px-4 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("col_qty")}
              </th>
              <th className="text-end px-4 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("col_unit")}
              </th>
              <th className="text-end px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("col_price")}
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr
                key={item.id}
                className={
                  i > 0 ? "border-t border-slate-100 dark:border-slate-800" : ""
                }
              >
                <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200">
                  {item.product_name}
                </td>
                <td className="px-4 py-3.5 text-end font-mono text-slate-500 dark:text-slate-400">
                  {item.quantity}
                </td>
                <td className="px-4 py-3.5 text-end text-slate-500 dark:text-slate-400">
                  {item.unit}
                </td>
                <td className="px-5 py-3.5 text-end font-mono text-slate-800 dark:text-slate-200">
                  {item.price}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <td
                colSpan={3}
                className="px-5 py-3.5 text-sm font-semibold text-slate-500 dark:text-slate-400 text-end"
              >
                {t("col_total")}
              </td>
              <td className="px-5 py-3.5 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                {order.total}{" "}
                <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">
                  {order.currency}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
          <svg
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
            />
          </svg>
          {t("meta_notes")}
        </p>
        <div className="relative">
          <textarea
            rows={3}
            defaultValue={order.notes ?? ""}
            placeholder="Add special instructions, delivery notes, or any remarks…"
            onBlur={(e) => handleNotes(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors resize-none"
          />
          {savingNotes && (
            <div className="absolute bottom-2.5 right-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="animate-spin text-slate-400"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="opacity-25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {order.status === "pending" && (
          <button
            onClick={confirm}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {t("btn_confirm_order")}
          </button>
        )}
        {order.status === "confirmed" && (
          <button
            onClick={fulfill}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {t("btn_fulfill")}
          </button>
        )}
        {order.status === "fulfilled" && (
          <button
            onClick={invoice}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {t("btn_generate_invoice")}
          </button>
        )}
        {order.status === "invoiced" && (
          <span className="text-slate-400 dark:text-slate-500 text-sm py-2.5">
            {t("invoice_generated")}
          </span>
        )}
      </div>
    </div>
  );
}
