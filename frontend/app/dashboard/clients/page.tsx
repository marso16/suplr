"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Client } from "@/types";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    api.clients
      .list()
      .then(setClients)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t("clients_title")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {t("clients_count", { n: clients.length })}
        </p>
      </div>

      {clients.length === 0 ? (
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
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t("clients_empty")}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_name")}
                </th>
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_whatsapp")}
                </th>
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_credit")}
                </th>
                <th className="text-end px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {t("col_balance")}
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, i) => {
                const balance = parseFloat(client.credit_balance);
                const hasBalance = balance > 0;
                return (
                  <tr
                    key={client.id}
                    className={
                      i > 0
                        ? "border-t border-slate-100 dark:border-slate-800"
                        : ""
                    }
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {client.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-slate-500 dark:text-slate-400">
                      {client.whatsapp_number.replace(
                        /@s\.whatsapp\.net$|@lid$/,
                        "",
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500">
                      {client.credit_terms ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <span
                        className={`font-mono text-sm font-semibold ${hasBalance ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-600"}`}
                      >
                        {hasBalance ? `$${balance.toFixed(2)}` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
