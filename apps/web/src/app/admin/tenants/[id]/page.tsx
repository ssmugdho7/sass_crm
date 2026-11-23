"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, money, platform } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { Badge, Button, Card, ErrorText, Field, Input, Link, Modal, PageHeader, Select, Spinner, Table, cx, fieldError } from "@/components/ui";
import {
  StatusBadge, TENANT_STATUSES, UserEditModal,
  type AdminUser, type PermissionGroup, type Plan, type Role, type Tenant,
} from "../../_shared";

type TenantModuleRow = { key: string; name: string; category: string; is_core: boolean; price_monthly: number; status: string; included_in_plan: boolean };
type Detail = { tenant: Tenant; modules: TenantModuleRow[]; users: AdminUser[]; roles: Role[] };
const TABS = ["Profile", "Add-ons", "Users", "Roles"] as const;

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, reload } = useFetch<Detail>(`/platform/tenants/${id}`, "platform");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const [actionError, setActionError] = useState<unknown>(null);

  async function destroy() {
    if (!data) return;
    const name = data.tenant.name;
    const typed = prompt(`This permanently deletes "${name}" and all its data. Type the account name to confirm:`);
    if (typed === null) return;
    if (typed.trim() !== name.trim()) {
      setActionError(new Error("The account name didn't match — nothing was deleted."));
      return;
    }
    try {
      await platform(`/platform/tenants/${id}`, { method: "DELETE" });
      router.push("/admin/tenants");
    } catch (e) {
      setActionError(e);
    }
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return <Spinner />;
  const t = data.tenant;

  return (
    <>
      <Link href="/admin/tenants" className="text-sm text-slate-500 hover:text-slate-800">← CRM Accounts</Link>
      <PageHeader
        title={t.name}
        subtitle={`/${t.slug} · ${t.plan?.name ?? "No plan"} · created ${formatDate(t.created_at)}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={t.status} />
            <Button variant="danger-ghost" className="px-3 py-1.5" onClick={destroy}>Delete account</Button>
          </div>
        }
      />
      <ErrorText error={actionError} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)}
            className={cx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium", tab === x ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {x}
          </button>
        ))}
      </div>
      {tab === "Profile" && <ProfileTab key={t.id + t.slug + t.status} tenant={t} onSaved={reload} />}
      {tab === "Add-ons" && <AddonsTab tenantId={t.id} modules={data.modules} onChanged={reload} />}
      {tab === "Users" && <UsersTab users={data.users} roles={data.roles} onChanged={reload} />}
      {tab === "Roles" && <RolesTab tenantId={t.id} roles={data.roles} onChanged={reload} />}
    </>
  );
}

const dateInput = (d: string | null) => (d ? d.slice(0, 10) : "");

function ProfileTab({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const { data: plans } = useFetch<Plan[]>("/platform/plans", "platform");
  const [form, setForm] = useState({
    name: tenant.name, slug: tenant.slug, email: tenant.email ?? "", phone: tenant.phone ?? "", plan_id: tenant.plan_id ? String(tenant.plan_id) : "",
    status: tenant.status, billing_cycle: tenant.billing_cycle, trial_ends_at: dateInput(tenant.trial_ends_at), current_period_end: dateInput(tenant.current_period_end),
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setSaved(false); setForm({ ...form, [k]: e.target.value }); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await platform(`/platform/tenants/${tenant.id}`, {
        method: "PUT",
        body: {
          ...form, email: form.email || null, phone: form.phone || null, plan_id: form.plan_id ? Number(form.plan_id) : null,
          trial_ends_at: form.trial_ends_at || null, current_period_end: form.current_period_end || null,
        },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <ErrorText error={error} />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Company name" error={fieldError(error, "name")}><Input value={form.name} onChange={set("name")} required /></Field>
          <Field label="Slug (website URL)" error={fieldError(error, "slug")}><Input value={form.slug} onChange={set("slug")} required /></Field>
          <Field label="Email" error={fieldError(error, "email")}><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone" error={fieldError(error, "phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Plan" error={fieldError(error, "plan_id")}>
            <Select value={form.plan_id} onChange={set("plan_id")}>
              <option value="">— No plan —</option>
              {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.price_monthly)}/mo)</option>)}
            </Select>
          </Field>
          <Field label="Billing cycle" error={fieldError(error, "billing_cycle")}>
            <Select value={form.billing_cycle} onChange={set("billing_cycle")}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <Field label="Status" error={fieldError(error, "status")}>
            <Select value={form.status} onChange={set("status")}>
              {TENANT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </Select>
          </Field>
          <Field label="Trial ends" error={fieldError(error, "trial_ends_at")}><Input type="date" value={form.trial_ends_at} onChange={set("trial_ends_at")} /></Field>
          <Field label="Current period ends" error={fieldError(error, "current_period_end")}><Input type="date" value={form.current_period_end} onChange={set("current_period_end")} /></Field>
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </Card>
  );
}

function AddonsTab({ tenantId, modules, onChanged }: { tenantId: number; modules: TenantModuleRow[]; onChanged: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(m: TenantModuleRow) {
    setBusy(m.key);
    setError(null);
    try {
      await platform(`/platform/tenants/${tenantId}/modules/${m.key}`, { method: "PUT", body: { enabled: m.status !== "active" } });
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(4)]:hidden">
      <ErrorText error={error} />
      <Table
        rows={modules}
        columns={[
          ["Module", (m) => <span className="font-medium text-slate-900">{m.name}</span>],
          ["Category", (m) => m.category],
          ["Price / mo", (m) => (m.is_core ? "—" : money(m.price_monthly))],
          ["In plan", (m) => (m.included_in_plan ? <Badge tone="blue">included</Badge> : "")],
          ["Status", (m) => m.is_core ? <Badge tone="green">core</Badge>
            : <Badge tone={m.status === "active" ? "green" : "gray"}>{m.status.replace("_", " ")}</Badge>],
          ["", (m) => !m.is_core && (
            <Button variant={m.status === "active" ? "secondary" : "primary"} className="px-3 py-1" disabled={busy === m.key} onClick={() => toggle(m)}>
              {m.status === "active" ? "Disable" : "Enable"}
            </Button>
          )],
        ]}
      />
    </Card>
  );
}

function UsersTab({ users, roles, onChanged }: { users: AdminUser[]; roles: Role[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const roleName = (id: number | null) => roles.find((r) => r.id === id)?.name ?? "—";
  return (
    <Card className="max-sm:[&_:is(th,td):nth-child(n+2):nth-child(-n+4)]:hidden max-sm:[&_:is(th,td):nth-child(6)]:hidden">
      <Table
        rows={users}
        onRow={setEditing}
        columns={[
          ["Name", (u) => <div><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500 sm:hidden">{u.email}</p></div>],
          ["Email", (u) => u.email],
          ["Phone", (u) => u.phone ?? "—"],
          ["Role", (u) => roleName(u.role_id)],
          ["Status", (u) => <StatusBadge status={u.status} />],
          ["Last login", (u) => formatDate(u.last_login_at)],
        ]}
      />
      <UserEditModal user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={onChanged} />
    </Card>
  );
}

function RolesTab({ tenantId, roles, onChanged }: { tenantId: number; roles: Role[]; onChanged: () => void }) {
  const { data: catalog } = useFetch<{ modules: PermissionGroup[] }>("/platform/permissions", "platform");
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function remove(r: Role) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    setError(null);
    try {
      await platform(`/platform/tenants/${tenantId}/roles/${r.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Card title="Roles" className="max-sm:[&_:is(th,td):nth-child(3)]:hidden" actions={<Button className="px-3 py-1.5" onClick={() => setEditing("new")}>New role</Button>}>
      <ErrorText error={error} />
      <Table
        rows={roles}
        onRow={setEditing}
        columns={[
          ["Role", (r) => <span className="flex items-center gap-2 font-medium text-slate-900">{r.name} {r.is_system && <Badge tone="blue">system</Badge>}</span>],
          ["Permissions", (r) => (r.permissions.includes("*") ? "Full access" : `${r.permissions.length} permissions`)],
          ["Users", (r) => r.users_count ?? 0],
          ["", (r) => !r.is_system && (
            <Button variant="danger-ghost" className="px-2 py-1" disabled={!!r.users_count} title={r.users_count ? "Has users" : "Delete"}
              onClick={(e) => { e.stopPropagation(); remove(r); }}>Delete</Button>
          )],
        ]}
      />
      <Modal open={!!editing} title={editing === "new" ? "New role" : `Edit ${editing ? (editing as Role).name : ""}`} onClose={() => setEditing(null)}>
        {editing && catalog && (
          <RoleForm key={editing === "new" ? "new" : editing.id} tenantId={tenantId} role={editing === "new" ? null : editing}
            groups={catalog.modules} onDone={() => { setEditing(null); onChanged(); }} />
        )}
      </Modal>
    </Card>
  );
}

function RoleForm({ tenantId, role, groups, onDone }: { tenantId: number; role: Role | null; groups: PermissionGroup[]; onDone: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const full = perms.includes("*");
  const toggle = (p: string) => setPerms(perms.includes(p) ? perms.filter((x) => x !== p) : [...perms, p]);
  const toggleGroup = (g: PermissionGroup) => {
    const all = g.permissions.every((p) => perms.includes(p));
    setPerms(all ? perms.filter((p) => !g.permissions.includes(p)) : [...new Set([...perms, ...g.permissions])]);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await platform(role ? `/platform/tenants/${tenantId}/roles/${role.id}` : `/platform/tenants/${tenantId}/roles`, {
        method: role ? "PUT" : "POST", body: { name, permissions: perms },
      });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorText error={error} />
      <Field label="Role name" error={fieldError(error, "name")}><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="accent-brand-600" checked={full} disabled={role?.is_system}
          onChange={() => setPerms(full ? [] : ["*"])} />
        Full access (*) {role?.is_system && <span className="text-xs font-normal text-slate-500">— required for the owner role</span>}
      </label>
      {fieldError(error, "permissions") && <p className="text-xs text-red-600">{fieldError(error, "permissions")}</p>}
      {!full && (
        <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <button type="button" onClick={() => toggleGroup(g)} className="text-left text-sm font-medium text-slate-800 hover:text-brand-700">
                {g.name} {!g.core && <span className="text-xs font-normal text-slate-400">add-on</span>}
              </button>
              <div className="flex flex-wrap gap-3 sm:justify-end">
                {g.permissions.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" className="accent-brand-600" checked={perms.includes(p)} onChange={() => toggle(p)} />
                    {p.split(".")[1]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-2">
        <Button disabled={busy}>{busy ? "Saving…" : "Save role"}</Button>
      </div>
    </form>
  );
}
