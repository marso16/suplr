"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Supplier } from "@/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    api.admin
      .suppliers()
      .then(setSuppliers)
      .catch(() => {
        setError("Access denied or not authenticated.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function setPlan(id: number, plan: string) {
    setBusy(id);
    try {
      const updated = await api.admin.setPlan(id, plan);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuspend(id: number) {
    setBusy(id);
    try {
      const updated = await api.admin.toggleSuspend(id);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } finally {
      setBusy(null);
    }
  }

  function logout() {
    localStorage.removeItem("admin_token");
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px]">
            Suplr Admin
          </span>
        </div>
        <button
          onClick={logout}
          className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Suppliers</h1>
          <p className="text-slate-400 text-sm mt-1">
            {suppliers.length} registered
          </p>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : suppliers.length === 0 ? (
          <div className="text-slate-500 text-sm">No suppliers yet.</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Supplier
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Plan
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Joined
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {suppliers.map((s) => (
                  <tr key={s.id} className={s.suspended ? "opacity-50" : ""}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{s.name}</div>
                      <div className="text-slate-400 text-xs">{s.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      {s.is_admin ? (
                        <span className="text-xs font-semibold text-violet-400">
                          Admin
                        </span>
                      ) : (
                        <select
                          value={s.plan}
                          disabled={busy === s.id}
                          onChange={(e) => setPlan(s.id, e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                        >
                          <option value="base">Base</option>
                          <option value="pro">Pro</option>
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {s.is_admin ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : s.suspended ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {new Date(s.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!s.is_admin && (
                        <button
                          onClick={() => toggleSuspend(s.id)}
                          disabled={busy === s.id}
                          className={`text-xs font-medium transition-colors disabled:opacity-50 ${
                            s.suspended
                              ? "text-emerald-400 hover:text-emerald-300"
                              : "text-red-400 hover:text-red-300"
                          }`}
                        >
                          {s.suspended ? "Reactivate" : "Suspend"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
