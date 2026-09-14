"use client";

export function RefreshButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label="Refresh"
      className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <svg
        width="14"
        height="14"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={loading ? "animate-spin" : ""}
      >
        <path d="M4.5 12a7.5 7.5 0 0114.137-3.5M19.5 12a7.5 7.5 0 01-14.137 3.5" />
        <path d="M19.5 4.5v4h-4" />
        <path d="M4.5 19.5v-4h4" />
      </svg>
    </button>
  );
}
