"use client";

import { useState } from "react";
import { crm, can, formatDate, money, toCents, toDollars } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, fieldError } from "@/components/ui";
import { useLookups, type Paginated } from "../appointments/_ops/shared";

type Assignment = { id: number; name: string; status: string; pivot: { scope: string | null; agreed_amount: number } };
type Sub = {
  id: number;
  company_name: string;
  contact_name: string | null;
  trade: string | null;
  email: string | null;
  phone: string | null;
  license_number: string | null;
  insurance_expiry: string | null;
  rate: number;
  notes: string | null;
  status: "active" | "inactive";
  insurance_expiring: boolean;
  insurance_expired: boolean;
  projects_count?: number;
  projects?: Assignment[];
};

const TRADES = ["Electrical", "Plumbing", "HVAC", "Carpentry", "Concrete", "Roofing", "Drywall", "Painting", "Landscaping", "Other"];

const empty = { company_name: "", contact_name: "", trade: "", email: "", phone: "", license_number: "", insurance_expiry: "", rate: "", notes: "", status: "active" };
type Form = typeof empty;

function Insurance({ s }: { s: Sub }) {
  if (!s.insurance_expiry) return <Badge tone="gray">No insurance on file</Badge>;
  if (s.insurance_expired) return <Badge tone="red">Expired {formatDate(s.insurance_expiry)}</Badge>;
  if (s.insurance_expiring) return <Badge tone="amber">Expires {formatDate(s.insurance_expiry)}</Badge>;
  return <span className="whitespace-nowrap text-slate-600">{formatDate(s.insurance_expiry)}</span>;
}

export default function SubcontractorsPage() {
  const { me } = useSession();
  const manage = can(me, "subcontractors.manage");
  const { projects } = useLookups();
  const [filters, setFilters] = useState({ search: "", trade: "", status: "", expiring: false });
  const q = new URLSearchParams();
  if (filters.search) q.set("search", filters.search);
  if (filters.trade) q.set("trade", filters.trade);
  if (filters.status) q.set("status", filters.status);
  if (filters.expiring) q.set("expiring", "1");
  const { data, error, reload } = useFetch<Paginated<Sub>>(`/app/subcontractors?${q}`);
  const rows = data?.data ?? (error ? [] : null);

  const [editing, setEditing] = useState<Sub | "new" | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [assign, setAssign] = useState({ project_id: "", scope: "", agreed_amount: "" });

  const open = async (s: Sub | "new") => {
    setFormError(null);
    setAssign({ project_id: "", scope: "", agreed_amount: "" });
    if (s === "new") {
      setForm(empty);
      setEditing("new");
      return;
    }
    setForm({
      company_name: s.company_name, contact_name: s.contact_name ?? "", trade: s.trade ?? "", email: s.email ?? "", phone: s.phone ?? "",
      license_number: s.license_number ?? "", insurance_expiry: s.insurance_expiry ?? "", rate: toDollars(s.rate), notes: s.notes ?? "", status: s.status,
    });
    setEditing(s);
    try {
      setEditing(await crm<Sub>(`/app/subcontractors/${s.id}`));
    } catch (e) {
      setFormError(e);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = {
      ...form, rate: toCents(form.rate) ?? 0, insurance_expiry: form.insurance_expiry || null, email: form.email || null,
    };
    try {
      if (editing === "new") {
        const created = await crm<Sub>("/app/subcontractors", { body });
        setEditing({ ...created, projects: [] });
      } else if (editing) {
        await crm(`/app/subcontractors/${editing.id}`, { method: "PATCH", body });
        setEditing(null);
      }
      reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || editing === "new" || !confirm(`Delete ${editing.company_name}?`)) return;
    try {
      await crm(`/app/subcontractors/${editing.id}`, { method: "DELETE" });
      setEditing(null);
      reload();
    } catch (e) {
      setFormError(e);
    }
  };

  const addAssignment = async () => {
    if (!editing || editing === "new" || !assign.project_id) return;
    try {
      const updated = await crm<Sub>(`/app/subcontractors/${editing.id}/assignments`, {
        body: { project_id: Number(assign.project_id), scope: assign.scope || null, agreed_amount: toCents(assign.agreed_amount) ?? 0 },
      });
      setEditing({ ...editing, projects: updated.projects });
      setAssign({ project_id: "", scope: "", agreed_amount: "" });
      reload();
    } catch (e) {
      setFormError(e);
    }
  };

  const unassign = async (projectId: number) => {
    if (!editing || editing === "new") return;
    try {
      const updated = await crm<Sub>(`/app/subcontractors/${editing.id}/assignments/${projectId}`, { method: "DELETE" });
      setEditing({ ...editing, projects: updated.projects });
      reload();
    } catch (e) {
      setFormError(e);
    }
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const warnings = (rows ?? []).filter((s) => s.insurance_expiring || s.insurance_expired).length;

  return (
    <div>
      <PageHeader
        title="Subcontractors"
        subtitle="Trades you work with, their insurance and the jobs they're on."
        actions={manage && <Button onClick={() => open("new")}>Add subcontractor</Button>}
      />

      {warnings > 0 && !filters.expiring && (
        <p className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          <span>{warnings} subcontractor{warnings > 1 ? "s have" : " has"} insurance expired or expiring within 30 days.</span>
          <button className="font-medium underline" onClick={() => setFilters({ ...filters, expiring: true })}>Show only these</button>
        </p>
      )}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Input placeholder="Search company or contact…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <Select value={filters.trade} onChange={(e) => setFilters({ ...filters, trade: e.target.value })}>
            <option value="">All trades</option>
            {TRADES.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={filters.expiring} onChange={(e) => setFilters({ ...filters, expiring: e.target.checked })} />
            Insurance expiring / expired
          </label>
        </div>
        <ErrorText error={error} />
        {rows === null ? (
          <Spinner />
        ) : (
          <div className="max-sm:[&_:is(th,td):nth-child(n+2):nth-child(-n+4)]:hidden max-sm:[&_:is(th,td):nth-child(6)]:hidden">
          <Table
            rows={rows}
            onRow={open}
            empty="No subcontractors yet."
            columns={[
              ["Company", (s) => <div><p className="font-medium text-slate-900">{s.company_name}</p><p className="text-xs text-slate-500">{s.contact_name}</p></div>],
              ["Trade", (s) => s.trade ?? "—"],
              ["Contact", (s) => <div className="text-xs"><p>{s.phone}</p><p className="text-slate-500">{s.email}</p></div>],
              ["Rate", (s) => (s.rate ? `${money(s.rate)}/hr` : "—")],
              ["Insurance", (s) => <Insurance s={s} />],
              ["Jobs", (s) => s.projects_count ?? 0],
              ["Status", (s) => <Badge tone={s.status === "active" ? "green" : "gray"}>{s.status}</Badge>],
            ]}
          />
          </div>
        )}
      </Card>

      <Modal open={editing !== null} title={editing === "new" ? "New subcontractor" : "Subcontractor"} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-3">
          <fieldset disabled={!manage} className="space-y-3">
            <Field label="Company name" error={fieldError(formError, "company_name")}><Input value={form.company_name} onChange={set("company_name")} required /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact name"><Input value={form.contact_name} onChange={set("contact_name")} /></Field>
              <Field label="Trade">
                <Input list="ops-trades" value={form.trade} onChange={set("trade")} placeholder="e.g. Electrical" />
                <datalist id="ops-trades">{TRADES.map((t) => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label="Email" error={fieldError(formError, "email")}><Input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
              <Field label="License number"><Input value={form.license_number} onChange={set("license_number")} /></Field>
              <Field label="Insurance expiry" error={fieldError(formError, "insurance_expiry")}><Input type="date" value={form.insurance_expiry} onChange={set("insurance_expiry")} /></Field>
              <Field label="Hourly rate ($)" error={fieldError(formError, "rate")}><Input type="number" min="0" step="0.01" value={form.rate} onChange={set("rate")} /></Field>
              <Field label="Status">
                <Select value={form.status} onChange={set("status")}><option value="active">Active</option><option value="inactive">Inactive</option></Select>
              </Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} /></Field>
          </fieldset>

          {editing && editing !== "new" && (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-800">Job assignments</p>
              {(editing.projects ?? []).length === 0 && <p className="text-sm text-slate-500">Not assigned to any job.</p>}
              <ul className="divide-y divide-slate-100">
                {(editing.projects ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.pivot.scope ?? "No scope"} · {money(p.pivot.agreed_amount)}</p>
                    </div>
                    {manage && <Button type="button" variant="danger-ghost" className="px-3 py-1" onClick={() => confirm(`Remove ${editing.company_name} from ${p.name}?`) && unassign(p.id)}>Remove</Button>}
                  </li>
                ))}
              </ul>
              {manage && (
                <div className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_7rem_auto]">
                  <Select value={assign.project_id} onChange={(e) => setAssign({ ...assign, project_id: e.target.value })} aria-label="Project">
                    <option value="">Select job…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  <Input placeholder="Scope" value={assign.scope} onChange={(e) => setAssign({ ...assign, scope: e.target.value })} />
                  <Input placeholder="Agreed $" type="number" min="0" step="0.01" value={assign.agreed_amount} onChange={(e) => setAssign({ ...assign, agreed_amount: e.target.value })} />
                  <Button type="button" variant="secondary" onClick={addAssignment} disabled={!assign.project_id}>Assign</Button>
                </div>
              )}
              {manage && projects.length === 0 && <p className="mt-1 text-xs text-slate-400">No jobs available to assign.</p>}
            </div>
          )}

          <ErrorText error={formError && !Object.keys((formError as { errors?: object }).errors ?? {}).length ? formError : null} />
          {manage && (
            <div className="flex justify-between pt-2">
              {editing !== "new" ? <Button type="button" variant="danger-ghost" onClick={remove}>Delete</Button> : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Close</Button>
                <Button disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
