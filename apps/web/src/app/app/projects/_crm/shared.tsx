"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/api";
import { Button, EmptyState, statusLabel } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";

/** Kept for older imports; prefer `@/lib/useFetch` directly. */
export { useFetch };

export type Ref = { id: number; name: string } | null;
export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number };

export type Lead = {
  id: number; name: string; email: string | null; phone: string | null; company: string | null; service: string | null;
  source: string; status: string; value: number; address: string | null; message: string | null;
  assigned_to: number | null; customer_id: number | null; assignee?: Ref; created_at: string;
};
export type Customer = {
  id: number; type: "individual" | "company"; name: string; email: string | null; phone: string | null;
  address: string | null; city: string | null; notes: string | null; projects_count?: number;
};
export type Project = {
  id: number; name: string; customer_id: number | null; site_address: string | null; status: string;
  start_date: string | null; due_date: string | null; budget: number; description: string | null; manager_id: number | null;
  customer?: Ref & { email?: string | null; phone?: string | null }; manager?: Ref; tasks?: Task[]; tasks_count?: number; open_tasks_count?: number;
};
export type Task = {
  id: number; title: string; description: string | null; project_id: number | null; status: string; priority: string;
  due_date: string | null; assigned_to: number | null; project?: Ref; assignee?: Ref;
};

export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"];
export const LEAD_SOURCES = ["manual", "website", "referral", "phone", "social"];
export const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"];
export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const PRIORITIES = ["low", "normal", "high", "urgent"];

const TONES: Record<string, string> = {
  new: "blue", contacted: "amber", qualified: "amber", won: "green", lost: "gray",
  planning: "blue", in_progress: "amber", on_hold: "gray", completed: "green", cancelled: "red",
  todo: "gray", done: "green", low: "gray", normal: "blue", high: "amber", urgent: "red",
  draft: "gray", sent: "blue", partial: "amber", paid: "green", overdue: "red", void: "gray",
};
export const tone = (s: string) => TONES[s] ?? "gray";
/** Alias of the shared ui `statusLabel` (kept for existing imports). */
export const label = statusLabel;

export const idOrNull = (v: string) => (v ? Number(v) : null);
export const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** "Mar 3, 2026 → Jun 1, 2026" for a start/due pair; "—" when both are empty. */
export const dateRange = (start: string | null | undefined, end: string | null | undefined) =>
  start || end ? `${start ? formatDate(start) : "?"} → ${end ? formatDate(end) : "?"}` : "—";

export const isOverdue = (t: Pick<Task, "status" | "due_date">) =>
  t.status !== "done" && !!t.due_date && t.due_date < new Date().toISOString().slice(0, 10);

/** Tenant users for assignee/manager pickers. */
export function useUsers() {
  return useFetch<{ id: number; name: string }[]>("/app/lookups/users").data ?? [];
}

/** Debounce a value (search boxes). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Pager({ page, last, onPage }: { page: number; last: number; onPage: (p: number) => void }) {
  if (last <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-600">
      <button className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
      <span>Page {page} of {last}</span>
      <button className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40" disabled={page >= last} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

/**
 * Stacked-card list for phones (below `sm`); pair with a table wrapped in `hidden sm:block`
 * so wide tables never push the page width at 390px.
 */
export function MobileList<T extends { id: number }>({ rows, empty = "Nothing here yet.", onRow, render }: {
  rows: T[]; empty?: string; onRow?: (r: T) => void; render: (r: T) => React.ReactNode;
}) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-500 sm:hidden">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 sm:hidden">
      {rows.map((r) => (
        <li
          key={r.id}
          onClick={onRow ? () => onRow(r) : undefined}
          className={`min-w-0 py-3 text-sm ${onRow ? "cursor-pointer active:bg-slate-50" : ""}`}
        >
          {render(r)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Empty result for a list page. With no filters it's a first-run EmptyState (icon, hint, primary action);
 * with filters/search applied it says nothing matched and offers to clear them.
 */
export function ListEmpty({ filtered, noun, onClear, icon, title, hint, action }: {
  filtered: boolean; noun: string; onClear: () => void; icon: string; title: string; hint: string; action?: React.ReactNode;
}) {
  if (filtered) {
    return (
      <EmptyState
        title={`No ${noun} match your filters`}
        hint="Try a different search or status."
        action={<Button variant="secondary" onClick={onClear}>Clear filters</Button>}
      />
    );
  }
  return <EmptyState icon={icon} title={title} hint={hint} action={action} />;
}

const iconPaths = {
  edit: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
};

/** Compact square icon button for table row actions; `label` becomes aria-label and tooltip. */
export function IconButton({ icon, label: text, danger, onClick }: { icon: keyof typeof iconPaths; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={text}
      title={text}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${danger ? "text-red-700 hover:bg-red-50" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d={iconPaths[icon]} />
      </svg>
    </button>
  );
}
