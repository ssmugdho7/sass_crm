"use client";

import { useEffect, useMemo, useState } from "react";
import { crm, can, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, PageHeader, Select, Spinner, Stat, Table, fieldError } from "@/components/ui";
import { addDays, idOrNull, startOfWeek, toCents, useLookups, ymd, type Paginated } from "../appointments/_ops/shared";

type Entry = {
  id: number;
  user_id: number;
  project_id: number | null;
  work_date: string;
  hours: number;
  notes: string | null;
  hourly_rate: number | null;
  approved: boolean;
  user?: { id: number; name: string } | null;
  project?: { id: number; name: string } | null;
};
type Summary = {
  total_hours: number;
  total_cost: number;
  by_project: { id: number | null; name: string; hours: number; cost: number }[];
  by_user: { id: number; name: string; hours: number; cost: number }[];
};

const dayLabel = (d: Date) => d.toLocaleDateString([], { weekday: "short", day: "numeric" });

export default function TimesheetsPage() {
  const { me } = useSession();
  const canLog = can(me, "timesheets.manage");
  const isManager = can(me, "team.manage");
  const { users, projects } = useLookups();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [filters, setFilters] = useState({ user_id: "", project_id: "" });
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  const blank = { work_date: ymd(new Date()), hours: "", project_id: "", user_id: "", hourly_rate: "", notes: "" };
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ from: ymd(week), to: ymd(addDays(week, 6)) });
    if (filters.user_id) q.set("user_id", filters.user_id);
    if (filters.project_id) q.set("project_id", filters.project_id);
    Promise.all([crm<Paginated<Entry>>(`/app/timesheets?${q}`), crm<Summary>(`/app/timesheets/summary?${q}`)])
      .then(([list, sum]) => {
        if (!live) return;
        setEntries(list.data);
        setSummary(sum);
        setError(null);
      })
      .catch((e) => live && (setError(e), setEntries([])));
    return () => {
      live = false;
    };
  }, [week, filters, tick]);

  // Weekly grid: one row per (user, project), hours per day.
  const grid = useMemo(() => {
    const rows = new Map<string, { key: string; user: string; project: string; hours: number[]; total: number }>();
    for (const e of entries ?? []) {
      const key = `${e.user_id}:${e.project_id ?? 0}`;
      const row = rows.get(key) ?? { key, user: e.user?.name ?? "—", project: e.project?.name ?? "No project", hours: Array(7).fill(0), total: 0 };
      const i = days.findIndex((d) => ymd(d) === e.work_date.slice(0, 10));
      if (i >= 0) row.hours[i] += Number(e.hours);
      row.total += Number(e.hours);
      rows.set(key, row);
    }
    return [...rows.values()];
  }, [entries, days]);
  const dayTotals = days.map((_, i) => grid.reduce((s, r) => s + r.hours[i], 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await crm("/app/timesheets", {
        body: {
          work_date: form.work_date, hours: Number(form.hours), project_id: idOrNull(form.project_id),
          user_id: isManager ? idOrNull(form.user_id) : null, hourly_rate: toCents(form.hourly_rate), notes: form.notes || null,
        },
      });
      setForm({ ...blank, work_date: form.work_date, project_id: form.project_id, hourly_rate: form.hourly_rate });
      reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const approve = async (entry: Entry, approved: boolean) => {
    try {
      await crm(`/app/timesheets/${entry.id}/approve`, { body: { approved } });
      reload();
    } catch (e) {
      setError(e);
    }
  };

  const remove = async (entry: Entry) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await crm(`/app/timesheets/${entry.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError(e);
    }
  };

  const fmt = (h: number) => (h ? h.toFixed(2).replace(/\.00$/, "") : "");
  const pendingCount = (entries ?? []).filter((e) => !e.approved).length;

  return (
    <div>
      <PageHeader title="Timesheets" subtitle={isManager ? "Crew hours by job. Approve entries to lock them." : "Log your hours against jobs."} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">←</Button>
        <Button variant="secondary" onClick={() => setWeek(startOfWeek(new Date()))}>This week</Button>
        <Button variant="secondary" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">→</Button>
        <span className="mx-2 text-sm font-medium text-slate-700">Week of {week.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
        {isManager && (
          <Select className="w-44" value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })} aria-label="Filter by person">
            <option value="">Everyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
        <Select className="w-48" value={filters.project_id} onChange={(e) => setFilters({ ...filters, project_id: e.target.value })} aria-label="Filter by job">
          <option value="">All jobs</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Hours this week" value={fmt(summary?.total_hours ?? 0) || "0"} />
        <Stat label="Labour cost" value={money(summary?.total_cost ?? 0)} hint="hours × hourly rate" />
        <Stat label="Awaiting approval" value={pendingCount} />
      </div>

      <ErrorText error={error} />

      {canLog && (
        <Card title="Log hours" className="mb-6">
          <form onSubmit={submit} className="grid items-end gap-3 md:grid-cols-6">
            <Field label="Date" error={fieldError(formError, "work_date")}><Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} required /></Field>
            <Field label="Hours" error={fieldError(formError, "hours")}><Input type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required /></Field>
            <Field label="Job" error={fieldError(formError, "project_id")}>
              <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">No job</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            {isManager ? (
              <Field label="Person" error={fieldError(formError, "user_id")}>
                <Select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                  <option value="">Me</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            )}
            <Field label="Rate ($/hr)" error={fieldError(formError, "hourly_rate")}><Input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></Field>
            <Button disabled={saving}>{saving ? "Saving…" : "Add entry"}</Button>
            {isManager && (
              <div className="md:col-span-6"><Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            )}
          </form>
        </Card>
      )}

      {entries === null ? (
        <Spinner />
      ) : (
        <>
          <Card title="Weekly hours" className="mb-6">
            {grid.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No hours logged this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Person</th>
                      <th className="px-3 py-2 text-left font-medium">Job</th>
                      {days.map((d) => <th key={ymd(d)} className="px-2 py-2 text-right font-medium">{dayLabel(d)}</th>)}
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grid.map((r) => (
                      <tr key={r.key}>
                        <td className="px-3 py-2 text-slate-800">{r.user}</td>
                        <td className="px-3 py-2 text-slate-600">{r.project}</td>
                        {r.hours.map((h, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{fmt(h)}</td>)}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>Total</td>
                      {dayTotals.map((h, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{fmt(h)}</td>)}
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(dayTotals.reduce((a, b) => a + b, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Entries" className="lg:col-span-2">
              <Table
                rows={entries}
                empty="No entries this week."
                columns={[
                  ["Date", (e) => e.work_date.slice(0, 10)],
                  ["Person", (e) => e.user?.name ?? "—"],
                  ["Job", (e) => e.project?.name ?? "—"],
                  ["Hours", (e) => fmt(Number(e.hours))],
                  ["Cost", (e) => (e.hourly_rate ? money(Math.round(Number(e.hours) * e.hourly_rate)) : "—")],
                  ["Notes", (e) => <span className="text-xs text-slate-500">{e.notes}</span>],
                  ["Status", (e) => <Badge tone={e.approved ? "green" : "amber"}>{e.approved ? "approved" : "pending"}</Badge>],
                  ["", (e) => (
                    <div className="flex justify-end gap-1">
                      {isManager && <Button variant="ghost" className="px-2 py-1" onClick={() => approve(e, !e.approved)}>{e.approved ? "Unapprove" : "Approve"}</Button>}
                      {canLog && (isManager || !e.approved) && <Button variant="ghost" className="px-2 py-1 text-red-600" onClick={() => remove(e)}>Delete</Button>}
                    </div>
                  )],
                ]}
              />
            </Card>
            <Card title="Hours by job">
              {summary?.by_project.length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {summary.by_project.map((p) => (
                    <li key={p.id ?? 0} className="flex justify-between py-2">
                      <span className="text-slate-700">{p.name}</span>
                      <span className="tabular-nums text-slate-900">{fmt(p.hours)} h · {money(p.cost)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nothing yet.</p>
              )}
              {isManager && !!summary?.by_user.length && (
                <>
                  <p className="mb-1 mt-4 text-xs font-semibold uppercase text-slate-500">By person</p>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {summary.by_user.map((u) => (
                      <li key={u.id} className="flex justify-between py-2">
                        <span className="text-slate-700">{u.name}</span>
                        <span className="tabular-nums text-slate-900">{fmt(u.hours)} h</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
