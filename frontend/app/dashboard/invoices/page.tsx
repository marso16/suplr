"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/Spinner";
import { EmptyState, ReceiptIllustration } from "@/components/EmptyState";

function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let startTs: number;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / duration, 1);
      setValue(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
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
    api.invoices.list().then(setInvoices).finally(() => setLoading(false));
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

  const paid = invoices.filter((i) => i.paid_at);
  const outstanding = invoices.filter((i) => !i.paid_at);
  const outstandingTotal = outstanding.reduce(
    (sum, i) => sum + parseFloat(i.total),
    0,
  );

  const totalCount = useCountUp(invoices.length);
  const paidCount = useCountUp(paid.length);
  const outstandingCount = useCountUp(outstanding.length);

  if (loading) return <TableSkeleton rows={5} cols={6} />;

  return (
    <div className="h-full flex flex-col">
      {/* Header — pinned */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 flex-shrink-0 flex items-start justify-between gap-4 flex-wrap">
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
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 px-3.5 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
        )}
      </div>

      {/* KPI summary */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Total</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{totalCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide mb-1">{t("status_paid")}</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{paidCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-1">{t("status_outstanding")}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{outstandingCount}</p>
              {outstandingTotal > 0 && (
                <span className="text-xs font-semibold text-amber-500 dark:text-amber-500 tabular-nums">
                  ${outstandingTotal.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8">
      {invoices.length === 0 ? (
        <EmptyState illustration={<ReceiptIllustration />} title={t("invoices_empty")} />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_number")}</th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_name")}</th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_order")}</th>
                <th className="text-end px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_total")}</th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_issued")}</th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_payment")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  {/* Invoice number */}
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-slate-400 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      {inv.number}
                    </span>
                  </td>

                  {/* Client */}
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                    {inv.client_name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>

                  {/* Order */}
                  <td className="px-5 py-3.5">
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[12px]">#{inv.order_id}</span>
                  </td>

                  {/* Total */}
                  <td className="px-5 py-3.5 text-end font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {inv.total}
                    <span className="text-[11px] font-normal text-slate-400 ml-1">{inv.currency}</span>
                  </td>

                  {/* Issued date */}
                  <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 font-mono text-[12px] tabular-nums">
                    {new Date(inv.issued_at).toLocaleDateString()}
                  </td>

                  {/* Status badge */}
                  <td className="px-5 py-3.5">
                    {inv.paid_at ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        {t("status_paid")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {t("status_outstanding")}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => downloadPdf(inv.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:border-slate-600 transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        PDF
                      </button>
                      {!inv.paid_at && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          disabled={paying === inv.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                        >
                          {paying === inv.id ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="animate-spin">
                              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" className="opacity-25" />
                              <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          {t("btn_mark_paid")}
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
    </div>
  );
}
