"use client";

import { useEffect, useState } from "react";
import { crm } from "@/lib/api";

// Shared helpers for the Operations add-on pages (appointments, subcontractors, timesheets, expenses).
export type Option = { id: number; name: string };
export type Paginated<T> = { data: T[]; total?: number; current_page?: number; last_page?: number };

const unwrap = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? r : Array.isArray((r as { data?: unknown })?.data) ? (r as { data: Record<string, unknown>[] }).data : [];

/** Users + projects for selects. Lookup endpoints are owned by another module, so failures yield empty lists. */
export function useLookups() {
  const [users, setUsers] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  useEffect(() => {
    crm("/app/lookups/users")
      .then((r) => setUsers(unwrap(r).map((u) => ({ id: Number(u.id), name: String(u.name ?? u.email ?? `User ${u.id}`) }))))
      .catch(() => {});
    crm("/app/projects?per_page=100")
      .then((r) => setProjects(unwrap(r).map((p) => ({ id: Number(p.id), name: String(p.name ?? `Project ${p.id}`) }))))
      .catch(() => {});
  }, []);
  return { users, projects };
}

/** "12.50" dollars → 1250 cents; empty → null. */
export const toCents = (v: string): number | null => (v.trim() === "" ? null : Math.round(parseFloat(v) * 100));
/** cents → "12.50" for inputs. */
export const toDollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
export const idOrNull = (v: string) => (v ? Number(v) : null);

const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Local value for <input type="datetime-local">. */
export const localDateTime = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Monday 00:00 of the week containing d. */
export const startOfWeek = (d: Date) => {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};
export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
