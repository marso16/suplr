"use client";
import type { ReactNode } from "react";

export function EmptyState({
  illustration,
  title,
  action,
}: {
  illustration: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5">{illustration}</div>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InboxIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Tray body */}
      <path
        d="M8 36h48v14a2 2 0 01-2 2H10a2 2 0 01-2-2V36z"
        className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
      />
      {/* Tray separator */}
      <line x1="8" y1="36" x2="56" y2="36" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />
      {/* Paper */}
      <rect
        x="18" y="9" width="28" height="24" rx="2"
        className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700"
        strokeWidth="1.5"
      />
      {/* Lines on paper */}
      <line x1="23" y1="17" x2="40" y2="17" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="22" x2="34" y2="22" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="27" x2="37" y2="27" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" strokeLinecap="round" />
      {/* Emerald accent dot */}
      <circle cx="43" cy="17" r="3" className="fill-emerald-400 dark:fill-emerald-500" />
    </svg>
  );
}

export function PeopleIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Person 2 body (back) */}
      <path
        d="M28 56c0-8.8 5.4-16 12-16s12 7.2 12 16"
        className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Person 2 head */}
      <circle cx="40" cy="20" r="8.5"
        className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
      />
      {/* Person 1 body (front) */}
      <path
        d="M6 56c0-9.4 6.3-17 14-17s14 7.6 14 17"
        className="fill-slate-200 dark:fill-slate-700 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Person 1 head */}
      <circle cx="20" cy="21" r="9.5"
        className="fill-slate-200 dark:fill-slate-700 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
      />
      {/* Add badge */}
      <circle cx="50" cy="10" r="6" className="fill-emerald-400 dark:fill-emerald-500" />
      <path d="M47.5 10h5M50 7.5v5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BoxIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Box body */}
      <rect x="10" y="26" width="44" height="30" rx="2"
        className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
      />
      {/* Left flap */}
      <path d="M10 26L23 10H32"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5" strokeLinejoin="round" fill="none"
      />
      {/* Right flap */}
      <path d="M54 26L41 10H32"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5" strokeLinejoin="round" fill="none"
      />
      {/* Center tape accent */}
      <line x1="26" y1="26" x2="38" y2="26" className="stroke-emerald-400 dark:stroke-emerald-500" strokeWidth="3" strokeLinecap="round" />
      {/* Vertical seam */}
      <line x1="32" y1="26" x2="32" y2="56" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  );
}

export function ReceiptIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Receipt body */}
      <path
        d="M16 4h32v52l-4-2.5-4 2.5-4-2.5-4 2.5-4-2.5-4 2.5-4-2.5-4 2.5V4z"
        className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700"
        strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Receipt lines */}
      <line x1="22" y1="14" x2="42" y2="14" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="21" x2="42" y2="21" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="28" x2="34" y2="28" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1.5" strokeLinecap="round" />
      {/* Divider above total */}
      <line x1="20" y1="36" x2="44" y2="36" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
      {/* Total line (emerald) */}
      <line x1="22" y1="42" x2="42" y2="42" className="stroke-emerald-400 dark:stroke-emerald-500" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MegaphoneIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Megaphone body */}
      <path
        d="M8 24h14L46 12v32L22 32H8V24z"
        className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Handle */}
      <path d="M22 32l5 12" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="2" strokeLinecap="round" />
      {/* Mouthpiece ring */}
      <circle cx="46" cy="28" r="4"
        className="fill-slate-200 dark:fill-slate-700 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
      />
      {/* Sound wave 1 */}
      <path d="M52 22c3 2 5 5 5 9s-2 7-5 9" className="stroke-emerald-400 dark:stroke-emerald-500" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Sound wave 2 */}
      <path d="M56 17c5 4 8 9 8 14s-3 10-8 14" className="stroke-emerald-300 dark:stroke-emerald-600" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}
