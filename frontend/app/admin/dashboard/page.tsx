"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SupplierWithStats, AdminOrder } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type Tab = "suppliers" | "orders" | "broadcast";

const STATUS_COLORS: Record<string, string> = {
  pending:   "text-amber-400 bg-amber-500/10",
  confirmed: "text-emerald-400 bg-emerald-500/10",
  fulfilled: "text-blue-400 bg-blue-500/10",
  invoiced:  "text-slate-400 bg-slate-500/10",
};

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Create Supplier Modal ─────────────────────────────────────────────────────
function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: SupplierWithStats) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const created = await api.admin.createSupplier(name, email, password) as unknown as SupplierWithStats;
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Supplier</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2.5 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Business Name", type: "text", value: name, set: setName, placeholder: "Keyrouz Trading" },
            { label: "Email", type: "email", value: email, set: setEmail, placeholder: "supplier@company.com" },
            { label: "Temporary Password", type: "password", value: password, set: setPassword, placeholder: "Min. 8 characters" },
          ].map(({ label, type, value, set, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">{label}</label>
              <input type={type} required minLength={type === "password" ? 8 : 1} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-colors" />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-700 text-slate-400 hover:text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {loading ? <><Spinner />Creating…</> : "Create Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.admin.changePassword(currentPw, newPw);
      setSaved(true);
      setTimeout(() => onClose(), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Change Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2.5 rounded-lg mb-4">{error}</div>}
        {saved && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-3 py-2.5 rounded-lg mb-4">Password updated</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Current Password", value: currentPw, set: setCurrentPw },
            { label: "New Password", value: newPw, set: setNewPw },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">{label}</label>
              <input type="password" required minLength={label.includes("Current") ? 1 : 8} value={value} onChange={(e) => set(e.target.value)} placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-colors" />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-700 text-slate-400 hover:text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {loading ? <><Spinner />Updating…</> : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("suppliers");
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  // Broadcast state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    Promise.all([api.admin.suppliers(), api.admin.orders()])
      .then(([s, o]) => { setSuppliers(s); setOrders(o); })
      .catch(() => setError("Access denied or not authenticated."))
      .finally(() => setLoading(false));
  }, []);

  async function toggleSuspend(id: number) {
    setBusy(id);
    try {
      const updated = await api.admin.toggleSuspend(id);
      setSuppliers((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
    } finally {
      setBusy(null);
    }
  }

  async function deleteSupplier(id: number) {
    setBusy(id);
    try {
      await api.admin.deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusy(null);
      setDeleteConfirm(null);
    }
  }

  async function impersonate(id: number) {
    setBusy(id);
    try {
      const { access_token } = await api.admin.impersonate(id);
      window.open(`${BASE_URL}/dashboard?impersonate=${access_token}`, "_blank");
    } finally {
      setBusy(null);
    }
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBroadcastStatus("sending");
    try {
      await api.admin.broadcast(subject, message);
      setBroadcastStatus("sent");
      setSubject("");
      setMessage("");
    } catch {
      setBroadcastStatus("error");
    }
  }

  function logout() {
    localStorage.removeItem("admin_token");
    router.push("/login");
  }

  const realSuppliers = suppliers.filter((s) => !s.is_admin);

  return (
    <div className="min-h-screen bg-slate-950">
      {showCreate && (
        <CreateSupplierModal
          onClose={() => setShowCreate(false)}
          onCreated={(s) => setSuppliers((prev) => [s, ...prev])}
        />
      )}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {/* Delete confirm modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white mb-2">Delete supplier?</h2>
            <p className="text-slate-400 text-sm mb-5">This will permanently delete the supplier and all their data — orders, clients, invoices, products. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-slate-700 text-slate-400 hover:text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => deleteSupplier(deleteConfirm)} disabled={busy === deleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                {busy === deleteConfirm ? <><Spinner />Deleting…</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px]">Suplr Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowChangePw(true)} className="text-slate-400 hover:text-slate-200 text-sm transition-colors flex items-center gap-1.5 cursor-pointer">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Password
          </button>
          <span className="text-slate-700">·</span>
          <button onClick={logout} className="text-slate-400 hover:text-slate-200 text-sm transition-colors cursor-pointer">Sign out</button>
        </div>
      </header>

      <main className="px-8 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-slate-800 pb-0">
          {(["suppliers", "orders", "broadcast"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px cursor-pointer ${
                tab === t ? "border-violet-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : (
          <>
            {/* ── Suppliers tab ── */}
            {tab === "suppliers" && (
              <>
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-white">Suppliers</h1>
                    <p className="text-slate-400 text-sm mt-1">
                      {realSuppliers.length} registered · {realSuppliers.filter(s => s.is_active).length} active this week
                    </p>
                  </div>
                  <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    New Supplier
                  </button>
                </div>

                {realSuppliers.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-sm">No suppliers yet.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {["Supplier", "Activity", "Stats", "Last login", "Status", ""].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {realSuppliers.map((s) => (
                          <tr key={s.id} className={s.suspended ? "opacity-50" : ""}>
                            <td className="px-5 py-4">
                              <div className="font-medium text-white">{s.name}</div>
                              <div className="text-slate-400 text-xs">{s.email}</div>
                            </td>
                            <td className="px-5 py-4">
                              {s.is_active ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">Dormant</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex gap-3 text-xs text-slate-400">
                                <span title="Orders">{s.order_count} orders</span>
                                <span title="Clients">{s.client_count} clients</span>
                                <span title="Invoices">{s.invoice_count} inv</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-500">
                              {s.last_login_at
                                ? new Date(s.last_login_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                                : "Never"}
                            </td>
                            <td className="px-5 py-4">
                              {s.suspended
                                ? <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Suspended</span>
                                : <span className="text-xs font-medium text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full">Active</span>
                              }
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => impersonate(s.id)} disabled={busy === s.id}
                                  title="Login as this supplier"
                                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50 cursor-pointer">
                                  Login as
                                </button>
                                <button onClick={() => toggleSuspend(s.id)} disabled={busy === s.id}
                                  className={`text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer ${s.suspended ? "text-emerald-400 hover:text-emerald-300" : "text-amber-400 hover:text-amber-300"}`}>
                                  {s.suspended ? "Reactivate" : "Suspend"}
                                </button>
                                <button onClick={() => setDeleteConfirm(s.id)} disabled={busy === s.id}
                                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── Orders tab ── */}
            {tab === "orders" && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-semibold text-white">Global Order Feed</h1>
                  <p className="text-slate-400 text-sm mt-1">Last 200 orders across all suppliers</p>
                </div>
                {orders.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-sm">No orders yet.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {["#", "Supplier", "Client", "Status", "Date"].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {orders.map((o) => (
                          <tr key={o.id}>
                            <td className="px-5 py-3.5 font-mono text-slate-400 text-xs">#{o.id}</td>
                            <td className="px-5 py-3.5 font-medium text-white">{o.supplier_name}</td>
                            <td className="px-5 py-3.5 text-slate-400">{o.client_name}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[o.status] ?? "text-slate-400 bg-slate-500/10"}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                              {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── Broadcast tab ── */}
            {tab === "broadcast" && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-semibold text-white">Broadcast Email</h1>
                  <p className="text-slate-400 text-sm mt-1">Send an announcement to all active (non-suspended) suppliers</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl">
                  {broadcastStatus === "sent" ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-emerald-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      <p className="text-white font-semibold">Sent to all suppliers</p>
                      <button onClick={() => setBroadcastStatus("idle")} className="text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">Send another</button>
                    </div>
                  ) : (
                    <form onSubmit={sendBroadcast} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Subject</label>
                        <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="System maintenance tonight"
                          className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-colors" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Message</label>
                        <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Dear supplier, we'll be performing maintenance…"
                          className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-colors resize-none" />
                      </div>
                      {broadcastStatus === "error" && (
                        <p className="text-xs text-red-400">Failed to send. Check SMTP configuration.</p>
                      )}
                      <button type="submit" disabled={broadcastStatus === "sending"}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                        {broadcastStatus === "sending" ? <><Spinner />Sending…</> : "Send to all suppliers"}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
