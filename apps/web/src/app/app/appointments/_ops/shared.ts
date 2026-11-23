"use client";

import { useFetch } from "@/lib/useFetch";

// Domain helpers for the Operations add-on pages (appointments, subcontractors, timesheets, expenses).
// Money/date formatting comes from @/lib/api (toCents, toDollars, money, formatDate).
export type Option = { id: number; name: string };
export type Paginated<T> = { data: T[]; total?: number; current_page?: number; last_page?: number };

type Row = Record<string, unknown>;
const unwrap = (r: unknown): Row[] =>
  Array.isArray(r) ? r : Array.isArray((r as { data?: unknown })?.data) ? (r as { data: Row[] }).data : [];

/** Users + projects for selects. Lookup endpoints are owned by another module, so failures yield empty lists. */
export function useLookups() {
  const { data: u } = useFetch<unknown>("/app/lookups/users");
  const { data: p } = useFetch<unknown>("/app/projects?per_page=100");
  const users: Option[] = unwrap(u).map((x) => ({ id: Number(x.id), name: String(x.name ?? x.email ?? `User ${x.id}`) }));
  const projects: Option[] = unwrap(p).map((x) => ({ id: Number(x.id), name: String(x.name ?? `Project ${x.id}`) }));
  return { users, projects };
}

export const idOrNull = (v: string) => (v ? Number(v) : null);

const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD (for API params and <input type="date">). */
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
/** Week-view day header, e.g. "Mon, Dec 7" (intentionally shorter than formatDate). */
export const dayHeader = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
/** Time of day, e.g. "9:30 AM". */
export const timeOf = (s: string) => new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
