"use client";

import { t } from "@/lib/strings";

/** Small shared UI primitives: cards, skeletons, error & empty states. */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="px-5 pt-5 pb-1">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
      <p className="text-red-800 text-sm leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
        >
          {t.common.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
      {message ?? t.common.empty}
    </div>
  );
}
