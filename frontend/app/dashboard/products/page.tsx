"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/Spinner";
import { useLanguage } from "@/components/LanguageProvider";
import type { Product } from "@/types";

interface FormState {
  name: string;
  sku: string;
  unit: string;
  price_usd: string;
  price_lbp: string;
}

const empty: FormState = { name: "", sku: "", unit: "", price_usd: "", price_lbp: "" };

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    price_usd: p.price_usd != null ? String(p.price_usd) : "",
    price_lbp: p.price_lbp != null ? String(p.price_lbp) : "",
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    api.products.list().then(setProducts).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showModal) setTimeout(() => nameRef.current?.focus(), 50);
  }, [showModal]);

  function openCreate() {
    setEditingProduct(null);
    setForm(empty);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditingProduct(p);
    setForm(productToForm(p));
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProduct(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        unit: form.unit.trim(),
        price_usd: form.price_usd.trim() || null,
        price_lbp: form.price_lbp.trim() || null,
      };

      if (editingProduct) {
        const updated = await api.products.update(editingProduct.id, payload as any);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await api.products.create(payload as any);
        setProducts((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err: any) {
      setError(err.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: number) {
    await api.products.deactivate(id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: false } : p)));
  }

  async function activate(id: number) {
    await api.products.activate(id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: true } : p)));
  }

  if (loading) return <LoadingScreen />;

  const isEdit = editingProduct !== null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("products_title")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t("products_count", { n: products.length })}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("btn_new_product")}
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t("products_empty")}</p>
          <button onClick={openCreate} className="text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:underline">
            {t("products_cta")}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_name")}</th>
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_sku")}</th>
                <th className="text-start px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_unit")}</th>
                <th className="text-end px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_usd")}</th>
                <th className="text-end px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_lbp")}</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_status")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className={i > 0 ? "border-t border-slate-100 dark:border-slate-800" : ""}>
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                  <td className="px-5 py-3.5 font-mono text-[12px] text-slate-400 dark:text-slate-500">{p.sku}</td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{p.unit}</td>
                  <td className="px-5 py-3.5 text-end font-mono text-slate-700 dark:text-slate-300">{p.price_usd ?? "—"}</td>
                  <td className="px-5 py-3.5 text-end font-mono text-slate-700 dark:text-slate-300">{p.price_lbp ?? "—"}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      p.active
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    }`}>
                      {p.active ? t("status_active") : t("status_inactive")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-end">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Edit"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      {p.active ? (
                        <button
                          onClick={() => deactivate(p.id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                        >
                          {t("btn_deactivate")}
                        </button>
                      ) : (
                        <button
                          onClick={() => activate(p.id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-emerald-500 dark:hover:text-emerald-400 text-xs transition-colors"
                        >
                          {t("btn_activate") ?? "Activate"}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isEdit ? (t("modal_edit_product") ?? "Edit Product") : t("modal_new_product")}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_name")} *</label>
                <input ref={nameRef} type="text" placeholder={t("placeholder_name")} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_sku")} *</label>
                  <input type="text" placeholder={t("placeholder_sku")} value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })} required
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_unit")} *</label>
                  <input type="text" placeholder={t("placeholder_unit")} value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })} required
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_price_usd")}</label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" step="0.01" min="0" placeholder="0.00" value={form.price_usd}
                      onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ps-7 pe-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_price_lbp")}</label>
                  <input type="number" step="1" min="0" placeholder="0" value={form.price_lbp}
                    onChange={(e) => setForm({ ...form, price_lbp: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors font-mono" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 rounded-lg font-medium text-sm transition-colors">
                  {t("btn_cancel")}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" className="opacity-25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      {t("btn_saving")}
                    </>
                  ) : isEdit ? (t("btn_save_changes") ?? "Save Changes") : t("btn_create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
