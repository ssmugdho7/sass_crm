"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { can, crm, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, fieldError } from "@/components/ui";
import {
  LEAD_SOURCES, LEAD_STATUSES, Pager, idOrNull, label, orNull, toCents, toDollars, tone, useDebounced, useFetch, useUsers,
  type Lead, type Page,
} from "../projects/_crm/shared";

function LeadForm({ lead, onSaved, onCancel }: { lead: Lead | null; onSaved: () => void; onCancel: () => void }) {
  const users = useUsers();
  const [f, setF] = useState({
    name: lead?.name ?? "", email: lead?.email ?? "", phone: lead?.phone ?? "", company: lead?.company ?? "",
    service: lead?.service ?? "", source: lead?.source ?? "manual", status: lead?.status ?? "new", value: toDollars(lead?.value),
    address: lead?.address ?? "", message: lead?.message ?? "", assigned_to: String(lead?.assigned_to ?? ""),
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: f.name, email: orNull(f.email), phone: orNull(f.phone), company: orNull(f.company), service: orNull(f.service),
        source: f.source, status: f.status, value: toCents(f.value), address: orNull(f.address), message: orNull(f.message),
        assigned_to: idOrNull(f.assigned_to),
      };
      await crm(lead ? `/app/leads/${lead.id}` : "/app/leads", { method: lead ? "PUT" : "POST", body });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorText error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fieldError(error, "name")}><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Company" error={fieldError(error, "company")}><Input value={f.company} onChange={set("company")} /></Field>
        <Field label="Email" error={fieldError(error, "email")}><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone" error={fieldError(error, "phone")}><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Service requested" error={fieldError(error, "service")}><Input value={f.service} onChange={set("service")} placeholder="Kitchen remodel" /></Field>
        <Field label="Estimated value ($)" error={fieldError(error, "value")}><Input type="number" min="0" step="0.01" value={f.value} onChange={set("value")} /></Field>
        <Field label="Source" error={fieldError(error, "source")}>
          <Select value={f.source} onChange={set("source")}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
        <Field label="Status" error={fieldError(error, "status")}>
          <Select value={f.status} onChange={set("status")}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
      </div>
      <Field label="Site address" error={fieldError(error, "address")}><Input value={f.address} onChange={set("address")} /></Field>
      <Field label="Assigned to" error={fieldError(error, "assigned_to")}>
        <Select value={f.assigned_to} onChange={set("assigned_to")}>
          <option value="">— Unassigned —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      <Field label="Notes / message" error={fieldError(error, "message")}><Textarea value={f.message} onChange={set("message")} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving}>{saving ? "Saving…" : lead ? "Save changes" : "Create lead"}</Button>
      </div>
    </form>
  );
}

function ConvertDialog({ lead, onDone, onCancel }: { lead: Lead; onDone: (customerId: number, projectId: number | null) => void; onCancel: () => void }) {
  const [createProject, setCreateProject] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await crm<{ customer: { id: number }; project: { id: number } | null }>(`/app/leads/${lead.id}/convert`, { body: { create_project: createProject } });
      onDone(r.customer.id, r.project?.id ?? null);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 text-sm">
      <ErrorText error={error} />
      <p className="text-slate-600">
        Create a customer from <strong>{lead.company || lead.name}</strong> (contact details and address are copied) and mark this lead as won.
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={createProject} onChange={(e) => setCreateProject(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        Also create a project{lead.service ? ` “${lead.service}”` : ""} with budget {money(lead.value)}
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={go} disabled={busy}>{busy ? "Converting…" : "Convert to customer"}</Button>
      </div>
    </div>
  );
}

function LeadsPage() {
  const { me } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const manage = can(me, "leads.manage");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, error, reload } = useFetch<Page<Lead>>(`/app/leads?page=${page}&search=${encodeURIComponent(q)}&status=${status}`);
  const [editing, setEditing] = useState<Lead | "new" | null>(params.get("new") ? "new" : null);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  async function remove(l: Lead) {
    if (!confirm(`Delete lead “${l.name}”?`)) return;
    try {
      await crm(`/app/leads/${l.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div>
      <PageHeader title="Leads" subtitle="Enquiries from your website, referrals and calls." actions={manage && <Button onClick={() => setEditing("new")}>+ New lead</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Search name, email, phone, service…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[12rem]">
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
        </div>
        <ErrorText error={error || actionError} />
        {!data ? !error && <Spinner /> : (
          <>
            <Table
              rows={data.data}
              empty="No leads match."
              columns={[
                ["Name", (l) => (
                  <div>
                    <p className="font-medium text-slate-900">{l.name}</p>
                    <p className="text-xs text-slate-500">{[l.company, l.email, l.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                )],
                ["Service", (l) => l.service || "—"],
                ["Source", (l) => label(l.source)],
                ["Value", (l) => money(l.value)],
                ["Status", (l) => <Badge tone={tone(l.status)}>{label(l.status)}</Badge>],
                ["Assigned", (l) => l.assignee?.name ?? "—"],
                ["", (l) => manage && (
                  <div className="flex justify-end gap-1">
                    {l.customer_id ? (
                      can(me, "customers.view") && <Button variant="ghost" className="px-2 py-1" onClick={() => router.push(`/app/customers/${l.customer_id}`)}>Customer</Button>
                    ) : (
                      l.status !== "lost" && <Button variant="secondary" className="px-2 py-1" onClick={() => setConverting(l)}>Convert</Button>
                    )}
                    <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(l)}>Edit</Button>
                    <Button variant="ghost" className="px-2 py-1 text-red-600" onClick={() => remove(l)}>Delete</Button>
                  </div>
                )],
              ]}
            />
            <Pager page={data.current_page} last={data.last_page} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={!!editing} title={editing === "new" ? "New lead" : "Edit lead"} onClose={() => setEditing(null)}>
        {editing && (
          <LeadForm
            key={editing === "new" ? "new" : editing.id}
            lead={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }}
          />
        )}
      </Modal>
      <Modal open={!!converting} title="Convert lead" onClose={() => setConverting(null)}>
        {converting && (
          <ConvertDialog
            lead={converting}
            onCancel={() => setConverting(null)}
            onDone={(cid, pid) => {
              setConverting(null);
              if (pid && can(me, "projects.view")) router.push(`/app/projects/${pid}`);
              else if (can(me, "customers.view")) router.push(`/app/customers/${cid}`);
              else reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><LeadsPage /></Suspense>;
}
