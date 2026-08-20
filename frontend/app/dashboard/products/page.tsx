"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/Spinner";
import { EmptyState, BoxIllustration } from "@/components/EmptyState";
import { useLanguage } from "@/components/LanguageProvider";
import type { Product } from "@/types";

const UNITS = ["kg", "g", "lb", "piece", "dozen", "box", "crate", "pack", "bundle", "liter"];
const LBP_RATE = 90_000;
const PAGE_SIZE = 8;

interface FormState {
  name: string;
  unit: string;
  price_usd: string;
}

const empty: FormState = { name: "", unit: "kg", price_usd: "" };

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    unit: p.unit,
    price_usd: p.price_usd != null ? String(p.price_usd) : "",
  };
}

type SortDir = "asc" | "desc" | null;
type StatusFilter = "all" | "active" | "inactive";

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      {dir === "asc" ? (
        <path d="M12 5l0 14M5 12l7-7 7 7" />
      ) : dir === "desc" ? (
        <path d="M12 19l0-14M5 12l7 7 7-7" />
      ) : (
        <>
          <path d="M8 9l4-4 4 4" />
          <path d="M16 15l-4 4-4-4" />
        </>
      )}
    </svg>
  );
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

  const [search, setSearch] = useState("");
  const [sortPrice, setSortPrice] = useState<SortDir>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.products.list().then(setProducts).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showModal) setTimeout(() => nameRef.current?.focus(), 50);
  }, [showModal]);

  useEffect(() => { setPage(1); }, [search, statusFilter, sortPrice]);

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
      const usdVal = parseFloat(form.price_usd) || null;
      const payload: Record<string, string | null> = {
        name: form.name.trim(),
        unit: form.unit,
        price_usd: usdVal != null ? String(usdVal) : null,
        price_lbp: usdVal != null ? String(Math.round(usdVal * LBP_RATE)) : null,
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

  if (loading) return <TableSkeleton rows={5} cols={7} />;

  const isEdit = editingProduct !== null;
  const activeCount = products.filter((p) => p.active).length;

  const afterFilter = products.filter((p) => {
    if (
      search.trim() &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !p.sku.toLowerCase().includes(search.toLowerCase())
    ) return false;
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "inactive" && p.active) return false;
    return true;
  });

  const afterSort = sortPrice
    ? [...afterFilter].sort((a, b) => {
        const av = parseFloat(String(a.price_usd ?? 0));
        const bv = parseFloat(String(b.price_usd ?? 0));
        return sortPrice === "asc" ? av - bv : bv - av;
      })
    : afterFilter;

  const totalPages = Math.max(1, Math.ceil(afterSort.length / PAGE_SIZE));
  const paginated = afterSort.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showStart = afterSort.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showEnd = Math.min(page * PAGE_SIZE, afterSort.length);

  return (
    <div className="h-full flex flex-col">
      {/* Header — pinned */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {t("products_title")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t("products_count", { n: products.length })}
              {products.length > 0 && activeCount < products.length && (
                <>
                  <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-slate-400 dark:text-slate-500">{t("products_inactive", { n: String(products.length - activeCount) })}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("btn_new_product")}
          </button>
        </div>

        {products.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-0 max-w-xs">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("products_search")}
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

            {/* Status filter */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 gap-0.5 bg-slate-50 dark:bg-slate-900">
              {(["all", "active", "inactive"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {s === "all" ? t("tab_all") : s === "active" ? t("status_active") : t("status_inactive")}
                </button>
              ))}
            </div>

            {/* Sort by price */}
            <button
              onClick={() => setSortPrice((prev) => prev === null ? "asc" : prev === "asc" ? "desc" : null)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                sortPrice
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                  : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <SortIcon dir={sortPrice} />
              {t("sort_price")}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8">
        {products.length === 0 ? (
          <EmptyState
            illustration={<BoxIllustration />}
            title={t("products_empty")}
            action={
              <button onClick={openCreate} className="text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                {t("products_cta")}
              </button>
            }
          />
        ) : afterSort.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">{t("products_no_match")}</p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setSortPrice(null); }}
              className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {t("btn_clear_filters")}
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_name")}</th>
                    <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_sku")}</th>
                    <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_unit")}</th>
                    <th className="text-end px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_usd")}</th>
                    <th className="text-end px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_lbp")}</th>
                    <th className="text-start px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("col_status")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${!p.active ? "opacity-50" : ""}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-slate-400 dark:text-slate-500">{p.sku}</td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{p.unit}</td>
                      <td className="px-5 py-3.5 text-end font-mono text-[13px] text-slate-700 dark:text-slate-300 tabular-nums">
                        {p.price_usd != null ? (
                          <span><span className="text-[11px] text-slate-400 mr-0.5">$</span>{p.price_usd}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-end font-mono text-[13px] text-slate-700 dark:text-slate-300 tabular-nums">
                        {p.price_lbp != null ? p.price_lbp : <span className="text-slate-300 dark:text-slate-700">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            {t("status_active")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                            {t("status_inactive")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          {p.active ? (
                            <button
                              onClick={() => deactivate(p.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/20"
                            >
                              {t("btn_deactivate")}
                            </button>
                          ) : (
                            <button
                              onClick={() => activate(p.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-500/20"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isEdit ? (t("modal_edit_product") ?? "Edit Product") : t("modal_new_product")}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_name")} *</label>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder={t("placeholder_name")}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_unit")} *</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    required
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("field_price_usd")}</label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.price_usd}
                      onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ps-7 pe-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {form.price_usd && parseFloat(form.price_usd) > 0 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">
                  {t("lbp_hint_prefix")}{" "}
                  <span className="font-semibold text-slate-600 dark:text-slate-300 font-mono">
                    {(Math.round(parseFloat(form.price_usd) * LBP_RATE)).toLocaleString()} LL
                  </span>
                  {" "}{t("lbp_hint_suffix", { rate: LBP_RATE.toLocaleString() })}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 rounded-lg font-medium text-sm transition-colors"
                >
                  {t("btn_cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" className="opacity-25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      {t("btn_saving")}
                    </>
                  ) : isEdit ? (
                    t("btn_save_changes") ?? "Save Changes"
                  ) : (
                    t("btn_create")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
