"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Invoice } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function downloadPdf(invoiceId: number) {
  const token = localStorage.getItem("token");
  const url = `${BASE}/invoices/${invoiceId}/pdf${token ? `?token=${token}` : ""}`;
  window.open(url, "_blank");
}

function downloadCsv() {
  const token = localStorage.getItem("token");
  const url = `${BASE}/invoices/export${token ? `?token=${token}` : ""}`;
  const a = document.createElement("a");
  a.href = url;
  a.click();
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<number | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    api.invoices
      .list()
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, []);

  async function markPaid(id: number) {
    setPaying(id);
    try {
      const updated = await api.invoices.markPaid(id);
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
    } finally {
      setPaying(null);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t("invoices_title")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("invoices_count", { n: invoices.length })}
          </p>
        </div>
        {invoices.length > 0 && (
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              className="text-slate-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t("invoices_empty")}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_number")}
                </th>
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_order")}
                </th>
                <th className="text-end px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_total")}
                </th>
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_issued")}
                </th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_payment")}
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr
                  key={inv.id}
                  className={
                    i > 0
                      ? "border-t border-slate-100 dark:border-slate-800"
                      : ""
                  }
                >
                  <td className="px-5 py-3.5 font-mono text-[13px] text-slate-800 dark:text-slate-200 font-medium">
                    {inv.number}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                    #{inv.order_id}
                  </td>
                  <td className="px-5 py-3.5 text-end font-mono font-medium text-slate-800 dark:text-slate-200">
                    {inv.total} {inv.currency}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 font-mono text-[12px]">
                    {new Date(inv.issued_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        inv.paid_at
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                      }`}
                    >
                      {inv.paid_at ? t("status_paid") : t("status_outstanding")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => downloadPdf(inv.id)}
                        className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {t("btn_download_pdf")}
                      </button>
                      {!inv.paid_at && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          disabled={paying === inv.id}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors"
                        >
                          {paying === inv.id ? "…" : t("btn_mark_paid")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
