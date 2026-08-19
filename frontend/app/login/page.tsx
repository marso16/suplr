"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import type { Lang } from "@/lib/translations";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await api.login(email, password);
      localStorage.setItem("token", access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message ?? t("error_invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <span className="font-semibold text-xl text-slate-900 dark:text-slate-100 tracking-tight">
            Suplr
          </span>
        </div>

        {/* Language switcher on login */}
        <div className="flex justify-center gap-1.5 mb-6">
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                lang === code
                  ? "bg-emerald-500 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {t("sign_in")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {t("sign_in_sub")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="email"
              >
                {t("field_email")}
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="password"
              >
                {t("field_password")}
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? t("btn_signing_in") : t("btn_sign_in")}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 dark:text-slate-600 text-xs mt-6">
          {t("login_footer")}
        </p>
      </div>
    </div>
  );
}
