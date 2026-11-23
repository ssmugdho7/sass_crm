"use client";

import { useCallback, useEffect, useState } from "react";
import { crm } from "@/lib/api";

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
export const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Dollars string (form input) ⇄ integer cents. */
export const toCents = (dollars: string) => Math.max(0, Math.round((parseFloat(dollars) || 0) * 100));
export const toDollars = (cents: number | null | undefined) => (cents ? (cents / 100).toFixed(2) : "");
export const idOrNull = (v: string) => (v ? Number(v) : null);
export const orNull = (v: string) => (v.trim() ? v.trim() : null);

export const isOverdue = (t: Pick<Task, "status" | "due_date">) =>
  t.status !== "done" && !!t.due_date && t.due_date < new Date().toISOString().slice(0, 10);

/** Load a GET endpoint; returns data, error and a reload function. Pass null to skip. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!path) return;
    let live = true;
    crm<T>(path)
      .then((r) => {
        if (!live) return;
        setData(r);
        setError(null);
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [path, tick]);
  return { data, error, reload, setData };
}

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
