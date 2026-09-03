"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/Spinner";
import { EmptyState, PeopleIllustration } from "@/components/EmptyState";
import { useLanguage } from "@/components/LanguageProvider";
import type { Client } from "@/types";

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatPhone(raw: string | null | undefined) {
  return raw?.replace(/@s\.whatsapp\.net$|@lid$/, "") ?? "";
}

const PAGE_SIZE = 8;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortName, setSortName] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const { t } = useLanguage();

  useEffect(() => {
    api.clients.list().then(setClients).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [search, sortName]);

  const totalOutstanding = clients.reduce(
    (sum, c) => sum + parseFloat(c.credit_balance),
    0,
  );

  const afterFilter = search.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          formatPhone(c.whatsapp_number).includes(search),
      )
    : clients;

  const afterSort = [...afterFilter].sort((a, b) =>
    sortName === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
  );

  const totalPages = Math.max(1, Math.ceil(afterSort.length / PAGE_SIZE));
  const paginated = afterSort.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showStart = afterSort.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showEnd = Math.min(page * PAGE_SIZE, afterSort.length);

  if (loading) return <TableSkeleton rows={6} cols={4} />;

  return (
    <div className="h-full flex flex-col">
      {/* Header — pinned */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {t("clients_title")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t("clients_count", { n: clients.length })}
            </p>
          </div>

          {/* KPI chips */}
          {clients.length > 0 && totalOutstanding > 0 && (
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-red-500 dark:text-red-400 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-red-700 dark:text-red-400 tabular-nums">
                ${totalOutstanding.toFixed(2)}
              </span>
              <span className="text-xs text-red-500 dark:text-red-500">
                {t("col_balance").toLowerCase()}
              </span>
            </div>
          )}
        </div>

        {/* Search + sort */}
        {clients.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("clients_search")}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={() => setSortName((s) => s === "asc" ? "desc" : "asc")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                {sortName === "asc" ? <path d="M8 9l4-4 4 4M12 5v14" /> : <path d="M16 15l-4 4-4-4M12 19V5" />}
              </svg>
              {sortName === "asc" ? t("sort_name_az") : t("sort_name_za")}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8">
      {clients.length === 0 ? (
        <EmptyState illustration={<PeopleIllustration />} title={t("clients_empty")} />
      ) : afterSort.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("clients_no_match", { query: search })}</p>
          <button onClick={() => setSearch("")} className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
            {t("btn_clear_search")}
          </button>
        </div>
      ) : (
        <>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_name")}
                </th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_whatsapp")}
                </th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("email_address")}
                </th>
                <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_credit")}
                </th>
                <th className="text-end px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_balance")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map((client) => {
                const balance = parseFloat(client.credit_balance);
                const hasBalance = balance > 0;
                const phone = formatPhone(client.whatsapp_number);
                const initials = client.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Name + avatar */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${avatarColor(client.name)}`}
                        >
                          {initials}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {client.name}
                        </span>
                      </div>
                    </td>

                    {/* WhatsApp */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-500 flex-shrink-0">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">
                          {phone}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3.5">
                      {client.email ? (
                        <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">
                          {client.email}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">—</span>
                      )}
                    </td>

                    {/* Credit terms */}
                    <td className="px-5 py-3.5">
                      {client.credit_terms ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {client.credit_terms}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">—</span>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="px-5 py-3.5 text-end">
                      {hasBalance ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 font-mono text-[12px] font-semibold tabular-nums">
                          ${balance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t("pagination_showing", { start: String(showStart), end: String(showEnd), total: String(afterSort.length) })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                {t("btn_prev")}
              </button>
              <span className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {t("btn_next")}
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          </div>
        )}
        </>
      )}
      </div>
    </div>
  );
}
