"use client";

import { useState } from "react";
import { platform } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { Badge, Button, ErrorText, Field, Input, Modal, Select, fieldError } from "@/components/ui";

export type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };
export type PlanRef = { id: number; name: string; slug?: string };
export type Plan = {
  id: number; name: string; slug: string; price_monthly: number; price_yearly: number; max_users: number;
  included_modules: string[] | null; features: string[] | null; is_active: boolean; sort: number; tenants_count?: number;
};
export type Tenant = {
  id: number; name: string; slug: string; email: string | null; phone: string | null; plan_id: number | null; plan: PlanRef | null;
  status: string; billing_cycle: string; trial_ends_at: string | null; current_period_end: string | null; created_at: string;
  users_count?: number; owner?: { id: number; name: string; email: string } | null;
};
export type Role = { id: number; tenant_id: number; name: string; slug: string; permissions: string[]; is_system: boolean; users_count?: number };
export type AdminUser = {
  id: number; tenant_id: number | null; role_id: number | null; name: string; email: string; phone: string | null; status: string;
  last_login_at: string | null; created_at: string; tenant?: { id: number; name: string; slug: string } | null; role?: { id: number; name: string; slug: string } | null;
};
export type PermissionGroup = { key: string; name: string; core: boolean; permissions: string[] };

export const TENANT_STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"] as const;
export const statusTone = (s: string) =>
  ({ active: "green", trial: "blue", past_due: "amber", suspended: "red", cancelled: "gray", disabled: "red" })[s] ?? "gray";
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)}>{status.replace("_", " ")}</Badge>;
export function Pager({ page, last, total, onPage }: { page: number; last: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm text-slate-500">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="px-3 py-1" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <span>{page} / {Math.max(last, 1)}</span>
        <Button variant="secondary" className="px-3 py-1" disabled={page >= last} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** Edit a CRM user: profile, status, role (roles of the user's tenant), optional new password. */
export function UserEditModal({ user, roles, onClose, onSaved }: { user: AdminUser | null; roles?: Role[]; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal open={!!user} title={user ? `Edit ${user.name}` : ""} onClose={onClose}>
      {user && <UserForm key={user.id} user={user} roles={roles} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function UserForm({ user, roles: given, onClose, onSaved }: { user: AdminUser; roles?: Role[]; onClose: () => void; onSaved: () => void }) {
  const { data: fetched } = useFetch<Role[]>(given || !user.tenant_id ? null : `/platform/tenants/${user.tenant_id}/roles`, "platform");
  const roles = given ?? fetched ?? [];
  const [form, setForm] = useState({
    name: user.name, email: user.email, phone: user.phone ?? "", status: user.status, role_id: user.role_id ? String(user.role_id) : "", password: "",
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await platform(`/platform/users/${user.id}`, {
        method: "PUT",
        body: {
          name: form.name, email: form.email, phone: form.phone || null, status: form.status,
          role_id: form.role_id ? Number(form.role_id) : null, ...(form.password ? { password: form.password } : {}),
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorText error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" error={fieldError(error, "name")}><Input value={form.name} onChange={set("name")} required /></Field>
        <Field label="Phone" error={fieldError(error, "phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
      </div>
      <Field label="Email" error={fieldError(error, "email")}><Input type="email" value={form.email} onChange={set("email")} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role" error={fieldError(error, "role_id")}>
          <Select value={form.role_id} onChange={set("role_id")}>
            <option value="">— No role —</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Status" error={fieldError(error, "status")}>
          <Select value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </Field>
      </div>
      <Field label="New password (leave blank to keep)" error={fieldError(error, "password")}>
        <Input type="password" value={form.password} onChange={set("password")} minLength={8} autoComplete="new-password" />
      </Field>
      <p className="text-xs text-slate-500">Changing the password or disabling the user signs them out everywhere.</p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
