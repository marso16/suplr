"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// ── Inline icons ──────────────────────────────────────────────────────────────
function IconEmail() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const ADMIN_FEATURES = [
  "Manage and review all supplier accounts",
  "Monitor platform-wide activity and usage",
  "Control system configuration and settings",
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { access_token } = await api.adminLogin(email, password);
      localStorage.setItem("admin_token", access_token);
      router.push("/admin/dashboard");
    } catch {
      setError("Invalid credentials or insufficient permissions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-[2fr_3fr]">
      {/* ── Brand panel (desktop only) ── */}
      <div className="hidden md:flex flex-col justify-between bg-slate-900 p-12 relative overflow-hidden border-r border-slate-800">
        {/* Violet gradient glow */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-500/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <span className="text-white font-bold text-xl tracking-tight">Suplr</span>
            <span className="ml-2 text-xs font-semibold text-violet-400 bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 rounded-md">
              ADMIN
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-snug mb-10">
            Platform Administration Panel
          </h2>
          <div className="space-y-4">
            {ADMIN_FEATURES.map((feat) => (
              <div key={feat} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-500/25 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{feat}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-slate-600 text-xs">Internal access only · Suplr Platform</p>
      </div>

      {/* ── Form panel ── */}
      <div className="flex flex-col items-start justify-center min-h-screen md:min-h-0 bg-slate-950 pl-12 pr-8 lg:pl-16 py-12">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-xl tracking-tight">Suplr</span>
            <span className="text-xs font-semibold text-violet-400 bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 rounded-md">
              ADMIN
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-1">Admin sign in</h1>
          <p className="text-sm text-slate-400 mb-8">
            Access the platform management panel
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-slate-400"
              >
                Email
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <IconEmail />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@suplr.app"
                  className="w-full bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-slate-400"
              >
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <IconLock />
                </span>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <IconEye off={showPw} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                "Sign in to Admin Panel"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
