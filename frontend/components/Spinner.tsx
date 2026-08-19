export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin text-emerald-500"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-15"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Spinner size={32} />
      {label && (
        <p className="text-slate-400 dark:text-slate-500 text-sm">{label}</p>
      )}
    </div>
  );
}
