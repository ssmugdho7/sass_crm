"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { can, crm, formatDate, money, toCents, toDollars } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, fieldError } from "@/components/ui";
import {
  IconButton, LEAD_SOURCES, LEAD_STATUSES, ListEmpty, MobileList, Pager, idOrNull, label, orNull, tone, useDebounced, useUsers,
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
        source: f.source, status: f.status, value: toCents(f.value) ?? 0, address: orNull(f.address), message: orNull(f.message),
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

  const primary = (l: Lead) =>
    l.customer_id ? (
      can(me, "customers.view") && <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => router.push(`/app/customers/${l.customer_id}`)}>Customer</Button>
    ) : (
      l.status !== "lost" && <Button className="px-2.5 py-1 text-xs" onClick={() => setConverting(l)}>Convert</Button>
    );
  const actions = (l: Lead) => (
    <>
      {primary(l)}
      <IconButton icon="edit" label={`Edit lead ${l.name}`} onClick={() => setEditing(l)} />
      <IconButton icon="trash" danger label={`Delete lead ${l.name}`} onClick={() => remove(l)} />
    </>
  );
  const filtered = !!(q || status);
  const clear = () => { setSearch(""); setStatus(""); setPage(1); };

  return (
    <div>
      <PageHeader title="Leads" subtitle="Enquiries from your website, referrals and calls." actions={manage && <Button onClick={() => setEditing("new")}>+ New lead</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Search name, email, phone, service…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:max-w-xs" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:max-w-[12rem]">
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
        </div>
        <ErrorText error={error || actionError} />
        {!data ? !error && <Spinner /> : data.data.length === 0 ? (
          <ListEmpty
            filtered={filtered}
            noun="leads"
            onClear={clear}
            icon="📥"
            title="No leads yet"
            hint="Enquiries from your website form land here automatically."
            action={manage && <Button onClick={() => setEditing("new")}>+ Add a lead</Button>}
          />
        ) : (
          <>
            <MobileList
              rows={data.data}
              render={(l) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{l.name}</p>
                      <p className="truncate text-xs text-slate-500">{[l.service, l.company, l.phone].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <Badge tone={tone(l.status)}>{l.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{money(l.value)} · {label(l.source)} · {formatDate(l.created_at)}</span>
                  </div>
                  {manage && <div className="flex flex-wrap items-center gap-1">{actions(l)}</div>}
                </div>
              )}
            />
            <div className="hidden overflow-x-auto sm:block">
              {/* Local table (not ui/Table) so low-value columns can collapse per breakpoint and the row fits ≥1280px without scrolling. */}
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-[34%] px-3 py-2 font-medium xl:w-[28%]">Lead</th>
                    <th className="w-[22%] px-3 py-2 font-medium">Service</th>
                    <th className="w-[13%] px-3 py-2 font-medium">Value</th>
                    <th className="w-[13%] px-3 py-2 font-medium">Status</th>
                    <th className="hidden w-[12%] px-3 py-2 font-medium xl:table-cell">Assigned</th>
                    <th className="w-[9.5rem] px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((l) => {
                    const sub = [l.company, l.email, l.phone].filter(Boolean).join(" · ");
                    return (
                      <tr key={l.id} className="align-top">
                        <td className="px-3 py-2.5 text-slate-700">
                          <p className="truncate font-medium text-slate-900" title={l.name}>{l.name}</p>
                          {sub && <p className="truncate text-xs text-slate-500" title={sub}>{sub}</p>}
                          <p className="text-xs text-slate-500">Received {formatDate(l.created_at)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          <p className="truncate" title={l.service ?? undefined}>{l.service || "—"}</p>
                          <p className="truncate text-xs text-slate-500">{label(l.source)}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{money(l.value)}</td>
                        <td className="px-3 py-2.5"><Badge tone={tone(l.status)}>{l.status}</Badge></td>
                        <td className="hidden px-3 py-2.5 text-slate-700 xl:table-cell">
                          <p className="truncate" title={l.assignee?.name}>{l.assignee?.name ?? "—"}</p>
                        </td>
                        <td className="px-2 py-2">
                          {manage && <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">{actions(l)}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
