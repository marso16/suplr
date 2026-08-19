"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import { LoadingScreen } from "@/components/Spinner";
import type { Supplier } from "@/types";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  // WhatsApp bridge connection
  const [bspEndpoint, setBspEndpoint] = useState("");
  const [bspApiKey, setBspApiKey] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingConn, setSavingConn] = useState(false);
  const [connSaved, setConnSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.me(), api.whatsapp.getConnection()])
      .then(([s, conn]) => {
        setSupplier(s);
        setName(s.name ?? "");
        setAddress(s.address ?? "");
        setPhone(s.phone ?? "");
        setLogo(s.logo ?? null);
        if (conn) {
          setBspEndpoint(conn.bsp_endpoint ?? "");
          setPhoneNumber(conn.phone_number ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogo(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.profile.update({ name, address, phone, logo });
      setSupplier(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveConnection() {
    if (!bspEndpoint || !phoneNumber) return;
    setSavingConn(true);
    setConnSaved(false);
    try {
      await api.whatsapp.saveConnection({
        bsp_endpoint: bspEndpoint,
        bsp_api_key: bspApiKey,
        phone_number: phoneNumber,
      });
      setConnSaved(true);
      setTimeout(() => setConnSaved(false), 2500);
    } finally {
      setSavingConn(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t("settings_title")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {t("settings_subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Logo */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            {t("settings_logo")}
          </p>
          <div className="flex items-start gap-5">
            {/* Upload zone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-1 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors flex-shrink-0 overflow-hidden"
            >
              {logo ? (
                <img
                  src={logo}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <>
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
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <span className="text-[10px] text-slate-400 text-center leading-tight px-1">
                    {t("settings_logo_upload")}
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("settings_logo_hint")}
              </p>
              {logo && (
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("settings_logo_change")}
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <button
                    onClick={removeLogo}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Business info */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Business Info
          </p>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("field_name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("settings_address")}
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("settings_address_placeholder")}
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("settings_phone")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("settings_phone_placeholder")}
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Email — read only */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("field_email")}
            </label>
            <input
              type="email"
              value={supplier?.email ?? ""}
              disabled
              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 rounded-lg text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* WhatsApp Bridge */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              WhatsApp Bridge
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Connection details for your Baileys bridge process
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Bridge Endpoint
            </label>
            <input
              type="url"
              value={bspEndpoint}
              onChange={(e) => setBspEndpoint(e.target.value)}
              placeholder="http://localhost:3001"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              API Key{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="password"
              value={bspApiKey}
              onChange={(e) => setBspApiKey(e.target.value)}
              placeholder="Leave empty if BSP_API_KEY is not set"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              WhatsApp Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+961 3 123 456"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleSaveConnection}
              disabled={savingConn || !bspEndpoint || !phoneNumber}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingConn ? (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="animate-spin"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="white"
                      strokeWidth="2.5"
                      className="opacity-25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {t("btn_saving")}
                </>
              ) : (
                "Save Connection"
              )}
            </button>
            {connSaved && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                {t("settings_saved")}
              </span>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="animate-spin"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="2.5"
                    className="opacity-25"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                {t("btn_saving")}
              </>
            ) : (
              t("btn_save_changes")
            )}
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              {t("settings_saved")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
