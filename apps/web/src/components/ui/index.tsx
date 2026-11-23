"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "danger-ghost" | "ghost" }) {
  const v = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    "danger-ghost": "text-red-700 ring-1 ring-red-200 hover:bg-red-50",
    ghost: "text-slate-700 hover:bg-slate-100",
  }[variant];
  return <button {...p} className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50", v, className)} />;
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const control = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/50 disabled:bg-slate-50 disabled:text-slate-500";
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(control, className)} />;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(control, className)} />;
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(control, className)} />;

export function Card({ title, actions, className, children }: { title?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
};
/** "past_due" → "Past due". Use for any status value shown to people. */
export const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const Badge = ({ tone = "gray", children }: { tone?: keyof typeof tones | string; children: React.ReactNode }) => (
  <span className={cx("inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1", tones[tone] ?? tones.gray)}>
    {typeof children === "string" ? statusLabel(children) : children}
  </span>
);

/** Simple data table. columns: [header, render(row)]. */
export function Table<T>({ rows, columns, empty = "Nothing here yet.", onRow }: { rows: T[]; columns: [string, (r: T) => React.ReactNode][]; empty?: React.ReactNode; onRow?: (r: T) => void }) {
  if (!rows.length) return typeof empty === "string" ? <p className="py-10 text-center text-sm text-slate-500">{empty}</p> : <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>{columns.map(([h]) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={cx(onRow && "cursor-pointer hover:bg-slate-50")}>
              {columns.map(([h, render]) => <td key={h} className="px-3 py-2.5 text-slate-700">{render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20" onClick={onClose}>
      <div role="dialog" aria-modal className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">✕</button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

/** First-run empty state: icon, title, hint and a primary action. */
export const EmptyState = ({ icon, title, hint, action }: { icon?: string; title: string; hint?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center px-4 py-12 text-center">
    {icon && <div aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">{icon}</div>}
    <p className="font-semibold text-slate-900">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-sm text-slate-600">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error instanceof ApiError || error instanceof Error ? error.message : String(error)}</p> : null;

export const fieldError = (error: unknown, key: string) => (error instanceof ApiError ? error.errors[key]?.[0] : undefined);

export const Spinner = () => <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>;

export { Link, cx };
