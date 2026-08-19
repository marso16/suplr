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

function OrderCardSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="ml-1.5 w-9 h-9 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 skeleton rounded w-28" />
        <div className="h-2.5 skeleton rounded w-44" />
      </div>
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <div className="h-3 skeleton rounded w-14" />
        <div className="h-5 skeleton rounded-full w-20" />
      </div>
      <div className="w-3.5 h-3.5 skeleton rounded flex-shrink-0" />
    </div>
  );
}

export function OrdersSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header skeleton */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-5 skeleton rounded w-24" />
          <div className="h-3.5 skeleton rounded w-36" />
        </div>
        <div className="h-9 skeleton rounded-lg w-16" />
      </div>
      {/* Tab pills skeleton */}
      <div className="flex gap-1.5 mb-5">
        {[80, 64, 76, 72, 68].map((w, i) => (
          <div key={i} className="h-8 skeleton rounded-full" style={{ width: w }} />
        ))}
      </div>
      {/* Cards */}
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-5 skeleton rounded w-28" />
          <div className="h-3.5 skeleton rounded w-32" />
        </div>
        <div className="h-9 skeleton rounded-lg w-24" />
      </div>
      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="h-10 skeleton border-b border-slate-100 dark:border-slate-800" />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              {Array.from({ length: cols }).map((_, j) => (
                <div
                  key={j}
                  className="h-3 skeleton rounded"
                  style={{ width: j === 0 ? 128 : j === cols - 1 ? 64 : 80 + (j % 2) * 24, marginLeft: j === cols - 1 ? "auto" : 0 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
