"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import { SettingsSkeleton } from "@/components/Spinner";
import type { Supplier } from "@/types";

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FieldInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors";

function SavedTick({ label }: { label: string }) {
  return (
    <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {label}
    </span>
  );
}

function SpinSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const [supplier, setSupplier] = useState<Supplier | null>(null);

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
  const [logoUploading, setLogoUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

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
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload to R2; on success switch to the permanent URL
    setLogoUploading(true);
    api.logo.upload(file)
      .then(({ url }) => setLogo(url))
      .catch(() => { /* keep data-URL fallback */ })
      .finally(() => setLogoUploading(false));
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
      await api.whatsapp.saveConnection({ bsp_endpoint: bspEndpoint, bsp_api_key: bspApiKey, phone_number: phoneNumber });
      setConnSaved(true);
      setTimeout(() => setConnSaved(false), 2500);
    } finally {
      setSavingConn(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwError(t("register_pw_mismatch")); return; }
    setSavingPw(true);
    setPwError("");
    setPwSaved(false);
    try {
      await api.profile.changePassword(currentPw, newPw);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : t("settings_pw_wrong"));
    } finally {
      setSavingPw(false);
    }
  }

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("settings_title")}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{t("settings_subtitle")}</p>
      </div>

      <div className="space-y-4">
        {/* Row 1 — Business Info (with logo inside) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-4">{t("settings_biz_info")}</p>

          <div className="flex gap-5">
            {/* Logo upload */}
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-[72px] h-[72px] rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-1 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors overflow-hidden"
              >
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-[9px] text-slate-400 text-center leading-tight px-1">{t("settings_logo_upload")}</span>
                  </>
                )}
                {logoUploading && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 flex items-center justify-center rounded-xl">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin text-emerald-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
              {logo && (
                <div className="flex justify-center gap-2 mt-1.5">
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline">{t("settings_logo_change")}</button>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <button onClick={removeLogo} className="text-[10px] text-red-500 hover:underline">Remove</button>
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3">
              <FieldInput label={t("field_name")}>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
              </FieldInput>
              <FieldInput label={t("field_email")}>
                <input type="email" value={supplier?.email ?? ""} disabled className={`${INPUT} bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed`} />
              </FieldInput>
              <FieldInput label={t("settings_phone")}>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("settings_phone_placeholder")} className={INPUT} />
              </FieldInput>
              <FieldInput label={t("settings_address")}>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("settings_address_placeholder")} className={INPUT} />
              </FieldInput>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleSave}
              disabled={saving || logoUploading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <><SpinSvg />{t("btn_saving")}</> : t("btn_save_changes")}
            </button>
            {saved && <SavedTick label={t("settings_saved")} />}
          </div>
        </div>

        {/* Row 2 — WhatsApp Bridge + Change Password side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* WhatsApp Bridge */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">WhatsApp Bridge</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Baileys bridge connection details</p>
            </div>

            <FieldInput label="Bridge Endpoint">
              <input type="url" value={bspEndpoint} onChange={(e) => setBspEndpoint(e.target.value)} placeholder="http://localhost:3001" className={`${INPUT} font-mono`} />
            </FieldInput>

            <FieldInput label={`API Key (optional)`}>
              <input type="password" value={bspApiKey} onChange={(e) => setBspApiKey(e.target.value)} placeholder={t("placeholder_api_key")} className={INPUT} />
            </FieldInput>

            <FieldInput label="WhatsApp Phone">
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+961 3 123 456" className={INPUT} />
            </FieldInput>

            <div className="flex items-center gap-3 pt-1 mt-auto">
              <button
                onClick={handleSaveConnection}
                disabled={savingConn || !bspEndpoint || !phoneNumber}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingConn ? <><SpinSvg />{t("btn_saving")}</> : "Save Connection"}
              </button>
              {connSaved && <SavedTick label={t("settings_saved")} />}
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("settings_change_pw")}</p>

            {pwError && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs px-3 py-2.5 rounded-lg">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <FieldInput label={t("settings_current_pw")}>
                <div className="relative">
                  <input type={showCurrentPw ? "text" : "password"} required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••" className={`${INPUT} pr-9`} />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <IconEye off={showCurrentPw} />
                  </button>
                </div>
              </FieldInput>

              <FieldInput label={t("settings_new_pw")}>
                <div className="relative">
                  <input type={showNewPw ? "text" : "password"} required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" className={`${INPUT} pr-9`} />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <IconEye off={showNewPw} />
                  </button>
                </div>
              </FieldInput>

              <FieldInput label={t("settings_confirm_new_pw")}>
                <div className="relative">
                  <input type={showNewPw ? "text" : "password"} required minLength={8} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" className={`${INPUT} pr-9`} />
                </div>
              </FieldInput>

              <div className="flex items-center gap-3 pt-1 mt-auto">
                <button
                  type="submit"
                  disabled={savingPw}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                  {savingPw ? <><SpinSvg />{t("btn_updating")}</> : t("btn_update_pw")}
                </button>
                {pwSaved && <SavedTick label={t("settings_pw_changed")} />}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
