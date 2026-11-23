"use client";

import { useMemo, useState } from "react";
import { crm, can, formatDate } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, fieldError } from "@/components/ui";
import { addDays, dayHeader, idOrNull, localDateTime, startOfWeek, timeOf as time, useLookups, ymd } from "./_ops/shared";

type Appointment = {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  status: Status;
  source: "manual" | "website";
  project_id: number | null;
  assigned_to: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  project?: { id: number; name: string } | null;
  assignee?: { id: number; name: string } | null;
  lead?: { id: number; name: string } | null;
};
type Status = "requested" | "confirmed" | "completed" | "cancelled";
const STATUSES: Status[] = ["requested", "confirmed", "completed", "cancelled"];
const tone: Record<Status, string> = { requested: "amber", confirmed: "blue", completed: "green", cancelled: "gray" };


const blank = () => {
  const s = new Date();
  s.setHours(s.getHours() + 1, 0, 0, 0);
  return {
    title: "", starts_at: localDateTime(s), ends_at: localDateTime(new Date(s.getTime() + 3600_000)), location: "", notes: "",
    status: "confirmed" as Status, project_id: "", assigned_to: "", contact_name: "", contact_email: "", contact_phone: "",
  };
};
type Form = ReturnType<typeof blank>;

export default function AppointmentsPage() {
  const { me } = useSession();
  const manage = can(me, "appointments.manage");
  const { users, projects } = useLookups();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<"week" | "list">("week");
  const [actionError, setActionError] = useState<unknown>(null);
  const [editing, setEditing] = useState<Appointment | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const to = `${ymd(addDays(week, 6))} 23:59:59`;
  const { data, error: loadError, reload: load } = useFetch<{ data: Appointment[] }>(`/app/appointments?from=${ymd(week)}&to=${encodeURIComponent(to)}`);
  const rows = useMemo(() => data?.data ?? (loadError ? [] : null), [data, loadError]);
  const error = actionError ?? loadError;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const byDay = useMemo(() => {
    const m: Record<string, Appointment[]> = {};
    for (const a of rows ?? []) (m[ymd(new Date(a.starts_at))] ??= []).push(a);
    return m;
  }, [rows]);
  const pending = (rows ?? []).filter((a) => a.source === "website" && a.status === "requested").length;

  const open = (a: Appointment | "new") => {
    setFormError(null);
    setEditing(a);
    setForm(
      a === "new"
        ? blank()
        : {
            title: a.title, starts_at: localDateTime(new Date(a.starts_at)), ends_at: localDateTime(new Date(a.ends_at)),
            location: a.location ?? "", notes: a.notes ?? "", status: a.status, project_id: a.project_id ? String(a.project_id) : "",
            assigned_to: a.assigned_to ? String(a.assigned_to) : "", contact_name: a.contact_name ?? "",
            contact_email: a.contact_email ?? "", contact_phone: a.contact_phone ?? "",
          },
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = {
      ...form,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      project_id: idOrNull(form.project_id),
      assigned_to: idOrNull(form.assigned_to),
      contact_email: form.contact_email || null,
    };
    try {
      if (editing === "new") await crm("/app/appointments", { body });
      else if (editing) await crm(`/app/appointments/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (a: Appointment, status: Status) => {
    try {
      await crm(`/app/appointments/${a.id}`, { method: "PATCH", body: { status } });
      setActionError(null);
      load();
    } catch (e) {
      setActionError(e);
    }
  };

  const remove = async () => {
    if (!editing || editing === "new" || !confirm("Delete this appointment?")) return;
    try {
      await crm(`/app/appointments/${editing.id}`, { method: "DELETE" });
      setEditing(null);
      load();
    } catch (e) {
      setFormError(e);
    }
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const chip = (a: Appointment) => (
    <button
      key={a.id}
      onClick={() => open(a)}
      className={`w-full rounded-lg border p-2 text-left text-xs transition hover:shadow ${a.source === "website" && a.status === "requested" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <p className="font-semibold text-slate-800">{time(a.starts_at)}</p>
      <p className="truncate text-slate-700">{a.title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge tone={tone[a.status]}>{a.status}</Badge>
        {a.source === "website" && <Badge tone="amber">website</Badge>}
      </div>
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Site visits, consultations and booking requests from your website."
        actions={manage && <Button onClick={() => open("new")}>New appointment</Button>}
      />

      {pending > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          {pending} booking request{pending > 1 ? "s" : ""} from your website this week need{pending > 1 ? "" : "s"} confirmation.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">←</Button>
          <Button variant="secondary" onClick={() => setWeek(startOfWeek(new Date()))}>This week</Button>
          <Button variant="secondary" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">→</Button>
          <span className="text-sm font-medium text-slate-700 sm:ml-2">{formatDate(ymd(week))} – {formatDate(ymd(addDays(week, 6)))}</span>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(["week", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm capitalize ${view === v ? "bg-white shadow-sm" : "text-slate-600"}`}>{v === "week" ? "Week" : "Agenda list"}</button>
          ))}
        </div>
      </div>

      <ErrorText error={error} />
      {rows === null ? (
        <Spinner />
      ) : view === "week" ? (
        <>
          <div className="hidden gap-3 md:grid md:grid-cols-7">
            {days.map((d) => {
              const isToday = ymd(d) === ymd(new Date());
              return (
                <div key={ymd(d)} className={`min-h-32 min-w-0 rounded-xl border p-2 ${isToday ? "border-brand-300 bg-brand-50/40" : "border-slate-200 bg-slate-50"}`}>
                  <p className={`mb-2 text-xs font-semibold uppercase ${isToday ? "text-brand-700" : "text-slate-500"}`}>{dayHeader(d)}</p>
                  <div className="space-y-2">{(byDay[ymd(d)] ?? []).map(chip)}</div>
                </div>
              );
            })}
          </div>
          {/* Small screens: agenda list of days that have appointments. */}
          <div className="space-y-4 md:hidden">
            {days.filter((d) => byDay[ymd(d)]?.length).length === 0 && <p className="py-10 text-center text-sm text-slate-500">No appointments this week.</p>}
            {days.filter((d) => byDay[ymd(d)]?.length).map((d) => (
              <section key={ymd(d)}>
                <p className={`mb-2 text-xs font-semibold uppercase ${ymd(d) === ymd(new Date()) ? "text-brand-700" : "text-slate-500"}`}>{dayHeader(d)}</p>
                <div className="space-y-2">{byDay[ymd(d)].map(chip)}</div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <Card className="max-sm:[&_:is(th,td):nth-child(n+3):nth-child(-n+6)]:hidden">
          <Table
            rows={rows}
            onRow={open}
            empty="No appointments this week."
            columns={[
              ["When", (a) => <span className="whitespace-nowrap">{formatDate(a.starts_at, true)}</span>],
              ["Title", (a) => <span className="font-medium text-slate-900">{a.title}</span>],
              ["Contact", (a) => a.contact_name ?? a.lead?.name ?? "—"],
              ["Project", (a) => a.project?.name ?? "—"],
              ["Assigned", (a) => a.assignee?.name ?? "—"],
              ["Source", (a) => <Badge tone={a.source === "website" ? "amber" : "gray"}>{a.source}</Badge>],
              ["Status", (a) =>
                manage ? (
                  <Select value={a.status} onClick={(e) => e.stopPropagation()} onChange={(e) => setStatus(a, e.target.value as Status)} className="w-32 py-1 sm:w-36">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                ) : (
                  <Badge tone={tone[a.status]}>{a.status}</Badge>
                )],
            ]}
          />
        </Card>
      )}

      <Modal open={editing !== null} title={editing === "new" ? "New appointment" : "Appointment"} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-3">
          <fieldset disabled={!manage} className="space-y-3">
            {editing && editing !== "new" && editing.source === "website" && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Booked from your website{editing.lead ? ` · lead: ${editing.lead.name}` : ""}.</p>
            )}
            <Field label="Title" error={fieldError(formError, "title")}><Input value={form.title} onChange={set("title")} required /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts" error={fieldError(formError, "starts_at")}><Input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} required /></Field>
              <Field label="Ends" error={fieldError(formError, "ends_at")}><Input type="datetime-local" value={form.ends_at} onChange={set("ends_at")} required /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
              </Field>
              <Field label="Assigned to" error={fieldError(formError, "assigned_to")}>
                <Select value={form.assigned_to} onChange={set("assigned_to")}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Project" error={fieldError(formError, "project_id")}>
              <Select value={form.project_id} onChange={set("project_id")}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Location"><Input value={form.location} onChange={set("location")} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Contact name"><Input value={form.contact_name} onChange={set("contact_name")} /></Field>
              <Field label="Email" error={fieldError(formError, "contact_email")}><Input type="email" value={form.contact_email} onChange={set("contact_email")} /></Field>
              <Field label="Phone"><Input value={form.contact_phone} onChange={set("contact_phone")} /></Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
          </fieldset>
          <ErrorText error={formError && !Object.keys((formError as { errors?: object }).errors ?? {}).length ? formError : null} />
          {manage && (
            <div className="flex justify-between pt-2">
              {editing !== "new" ? <Button type="button" variant="danger-ghost" onClick={remove}>Delete</Button> : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                <Button disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
