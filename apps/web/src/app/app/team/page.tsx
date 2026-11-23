"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, can, crm } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, cx, fieldError } from "@/components/ui";

type Role = { id: number; name: string; slug: string; permissions: string[]; is_system: boolean; users_count: number };
type Member = { id: number; name: string; email: string; phone: string | null; status: string; role_id: number | null; last_login_at: string | null; role: { id: number; name: string; slug: string } | null };
type Group = { module: string; name: string; permissions: string[] };
type Users = { data: Member[]; max_users: number | null; active_users: number };

const permLabel = (p: string) => (p.endsWith(".view") ? "View" : p.endsWith(".manage") ? "Manage" : p);

export default function TeamPage() {
  const { me, refresh } = useSession();
  const manage = can(me, "team.manage");
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<Users | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([crm<Users>("/app/team/users"), crm<{ data: Role[] }>("/app/team/roles"), crm<{ data: Group[] }>("/app/team/permissions")])
      .then(([u, r, g]) => {
        if (!live) return;
        setUsers(u);
        setRoles(r.data);
        setGroups(g.data);
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [tick]);

  const afterRoleChange = () => {
    reload();
    refresh();
  };

  return (
    <div>
      <PageHeader title="Team & Roles" subtitle="Invite staff and control what each role can see and do." />
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium sm:w-fit">
        {(["users", "roles"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("rounded-md px-4 py-1.5", tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
            {t === "users" ? "Team members" : "Roles"}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
      {!users ? (
        error ? null : <Spinner />
      ) : tab === "users" ? (
        <UsersTab users={users} roles={roles} manage={manage} meId={me?.id} onChange={reload} />
      ) : (
        <RolesTab roles={roles} groups={groups} manage={manage} onChange={afterRoleChange} />
      )}
    </div>
  );
}

function UsersTab({ users, roles, manage, meId, onChange }: { users: Users; roles: Role[]; manage: boolean; meId?: number; onChange: () => void }) {
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role_id: "" });
  const [err, setErr] = useState<unknown>(null);
  const [rowErr, setRowErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const full = users.max_users !== null && users.active_users >= users.max_users;

  const open = (m: Member | "new") => {
    setErr(null);
    setEditing(m);
    setForm(
      m === "new"
        ? { name: "", email: "", phone: "", password: "", role_id: String(roles.find((r) => !r.is_system)?.id ?? "") }
        : { name: m.name, email: m.email, phone: m.phone ?? "", password: "", role_id: String(m.role_id ?? "") },
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { ...form, role_id: Number(form.role_id), phone: form.phone || null };
      if (editing === "new") await crm("/app/team/users", { body });
      else if (editing) await crm(`/app/team/users/${editing.id}`, { method: "PUT", body });
      setEditing(null);
      onChange();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const act = async (m: Member, action: "disable" | "enable" | "delete") => {
    if (action === "delete" && !confirm(`Delete ${m.name}? This cannot be undone.`)) return;
    setRowErr(null);
    try {
      if (action === "delete") await crm(`/app/team/users/${m.id}`, { method: "DELETE" });
      else await crm(`/app/team/users/${m.id}/${action}`, { method: "POST" });
      onChange();
    } catch (e) {
      setRowErr(e);
    }
  };

  return (
    <Card
      title={`Team members${users.max_users !== null ? ` · ${users.active_users} of ${users.max_users} seats used` : ""}`}
      actions={manage && <Button onClick={() => open("new")} disabled={full} title={full ? "Your plan's user limit is reached" : undefined}>Add member</Button>}
    >
      {full && manage && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You&apos;ve used every seat on your plan. <a href="/app/billing" className="font-medium underline">Upgrade</a> to add more people.
        </p>
      )}
      <ErrorText error={rowErr} />
      <Table
        rows={users.data}
        columns={[
          ["Name", (m) => (<div><p className="font-medium text-slate-900">{m.name}{m.id === meId && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p><p className="text-xs text-slate-500">{m.email}</p></div>)],
          ["Role", (m) => m.role?.name ?? "—"],
          ["Status", (m) => <Badge tone={m.status === "active" ? "green" : "gray"}>{m.status}</Badge>],
          ["Last login", (m) => (m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : "Never")],
          ["", (m) =>
            manage && (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" className="px-2 py-1" onClick={() => open(m)}>Edit</Button>
                {m.id !== meId && (
                  <>
                    <Button variant="ghost" className="px-2 py-1" onClick={() => act(m, m.status === "active" ? "disable" : "enable")}>
                      {m.status === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" className="px-2 py-1 text-red-600" onClick={() => act(m, "delete")}>Delete</Button>
                  </>
                )}
              </div>
            )],
        ]}
      />
      <Modal open={editing !== null} title={editing === "new" ? "Add team member" : "Edit team member"} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-3">
          <ErrorText error={err instanceof ApiError && Object.keys(err.errors).length ? null : err} />
          <Field label="Name" error={fieldError(err, "name")}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" error={fieldError(err, "email")}><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone" error={fieldError(err, "phone")}><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Role" error={fieldError(err, "role_id")}>
            <Select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
              <option value="">Choose a role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label={editing === "new" ? "Password" : "New password (leave blank to keep)"} error={fieldError(err, "password")}>
            <Input type="password" minLength={8} required={editing === "new"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function RolesTab({ roles, groups, manage, onChange }: { roles: Role[]; groups: Group[]; manage: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [rowErr, setRowErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const locked = editing !== null && editing !== "new" && editing.is_system;

  const open = (r: Role | "new") => {
    setErr(null);
    setEditing(r);
    setName(r === "new" ? "" : r.name);
    setPerms(r === "new" ? ["dashboard.view"] : r.permissions);
  };
  const toggle = (p: string) => setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const toggleGroup = (g: Group) =>
    setPerms((cur) => (g.permissions.every((p) => cur.includes(p)) ? cur.filter((p) => !g.permissions.includes(p)) : [...new Set([...cur, ...g.permissions])]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { name, permissions: perms };
      if (editing === "new") await crm("/app/team/roles", { body });
      else if (editing) await crm(`/app/team/roles/${editing.id}`, { method: "PUT", body });
      setEditing(null);
      onChange();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Role) => {
    if (!confirm(`Delete the ${r.name} role?`)) return;
    setRowErr(null);
    try {
      await crm(`/app/team/roles/${r.id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      setRowErr(e);
    }
  };

  const summary = (r: Role) => (r.permissions.includes("*") ? "Full access" : `${r.permissions.length} permission${r.permissions.length === 1 ? "" : "s"}`);

  return (
    <Card title="Roles" actions={manage && <Button onClick={() => open("new")}>New role</Button>}>
      <ErrorText error={rowErr} />
      <Table
        rows={roles}
        columns={[
          ["Role", (r) => (<span className="font-medium text-slate-900">{r.name} {r.is_system && <Badge tone="blue">Locked</Badge>}</span>)],
          ["Access", summary],
          ["Members", (r) => r.users_count],
          ["", (r) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" className="px-2 py-1" onClick={() => open(r)}>{manage && !r.is_system ? "Edit" : "View"}</Button>
              {manage && !r.is_system && (
                <Button variant="ghost" className="px-2 py-1 text-red-600" disabled={r.users_count > 0} title={r.users_count > 0 ? "Reassign its members first" : undefined} onClick={() => remove(r)}>Delete</Button>
              )}
            </div>
          )],
        ]}
      />
      <Modal open={editing !== null} title={editing === "new" ? "New role" : locked ? "Owner role" : manage ? "Edit role" : "Role"} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-4">
          <ErrorText error={err instanceof ApiError && Object.keys(err.errors).length ? fieldError(err, "permissions") ?? null : err} />
          {locked && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">The owner role always has full access and can&apos;t be changed.</p>}
          <Field label="Role name" error={fieldError(err, "name")}>
            <Input required disabled={locked || !manage} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {!locked && (
            <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {groups.map((g) => (
                <div key={g.module} className="flex items-center justify-between gap-3 px-3 py-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input type="checkbox" disabled={!manage} checked={g.permissions.every((p) => perms.includes(p))} onChange={() => toggleGroup(g)} className="accent-brand-600" />
                    {g.name}
                  </label>
                  <div className="flex gap-3">
                    {g.permissions.map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-sm text-slate-600">
                        <input type="checkbox" disabled={!manage} checked={perms.includes(p)} onChange={() => toggle(p)} className="accent-brand-600" />
                        {permLabel(p)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{locked || !manage ? "Close" : "Cancel"}</Button>
            {manage && !locked && <Button disabled={busy}>{busy ? "Saving…" : "Save role"}</Button>}
          </div>
        </form>
      </Modal>
    </Card>
  );
}
