"use client";

import { useState } from "react";
import { crm } from "@/lib/api";
import { Button, ErrorText, Field, Input, Select, Textarea, fieldError } from "@/components/ui";
import {
  PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, idOrNull, label, orNull, toCents, toDollars, useFetch, useUsers,
  type Customer, type Page, type Project, type Task,
} from "./shared";

/** Create/edit a project. Calls onSaved with the saved project. */
export function ProjectForm({ project, customerId, onSaved, onCancel }: { project?: Project | null; customerId?: number; onSaved: (p: Project) => void; onCancel: () => void }) {
  const users = useUsers();
  const customers = useFetch<Page<Customer>>("/app/customers?per_page=100").data?.data ?? [];
  const [f, setF] = useState({
    name: project?.name ?? "", customer_id: String(project?.customer_id ?? customerId ?? ""), site_address: project?.site_address ?? "",
    status: project?.status ?? "planning", start_date: project?.start_date ?? "", due_date: project?.due_date ?? "",
    budget: toDollars(project?.budget), manager_id: String(project?.manager_id ?? ""), description: project?.description ?? "",
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
        name: f.name, customer_id: idOrNull(f.customer_id), site_address: orNull(f.site_address), status: f.status,
        start_date: f.start_date || null, due_date: f.due_date || null, budget: toCents(f.budget),
        manager_id: idOrNull(f.manager_id), description: orNull(f.description),
      };
      onSaved(await crm<Project>(project ? `/app/projects/${project.id}` : "/app/projects", { method: project ? "PUT" : "POST", body }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorText error={error} />
      <Field label="Job name" error={fieldError(error, "name")}><Input required value={f.name} onChange={set("name")} placeholder="Kitchen remodel – 12 Oak St" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer" error={fieldError(error, "customer_id")}>
          <Select value={f.customer_id} onChange={set("customer_id")}>
            <option value="">— None —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Status" error={fieldError(error, "status")}>
          <Select value={f.status} onChange={set("status")}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
      </div>
      <Field label="Site address" error={fieldError(error, "site_address")}><Input value={f.site_address} onChange={set("site_address")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" error={fieldError(error, "start_date")}><Input type="date" value={f.start_date} onChange={set("start_date")} /></Field>
        <Field label="Due date" error={fieldError(error, "due_date")}><Input type="date" value={f.due_date} onChange={set("due_date")} /></Field>
        <Field label="Budget ($)" error={fieldError(error, "budget")}><Input type="number" min="0" step="0.01" value={f.budget} onChange={set("budget")} /></Field>
        <Field label="Project manager" error={fieldError(error, "manager_id")}>
          <Select value={f.manager_id} onChange={set("manager_id")}>
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Scope / description" error={fieldError(error, "description")}><Textarea value={f.description} onChange={set("description")} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving}>{saving ? "Saving…" : project ? "Save changes" : "Create project"}</Button>
      </div>
    </form>
  );
}

/** Create/edit a task. projectId pre-selects (and locks) the project. */
export function TaskForm({ task, projectId, onSaved, onCancel }: { task?: Task | null; projectId?: number; onSaved: (t: Task) => void; onCancel: () => void }) {
  const users = useUsers();
  const projects = useFetch<Page<Project>>(projectId ? null : "/app/projects?per_page=100").data?.data ?? [];
  const [f, setF] = useState({
    title: task?.title ?? "", project_id: String(task?.project_id ?? projectId ?? ""), status: task?.status ?? "todo",
    priority: task?.priority ?? "normal", due_date: task?.due_date ?? "", assigned_to: String(task?.assigned_to ?? ""), description: task?.description ?? "",
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
        title: f.title, project_id: idOrNull(f.project_id), status: f.status, priority: f.priority,
        due_date: f.due_date || null, assigned_to: idOrNull(f.assigned_to), description: orNull(f.description),
      };
      onSaved(await crm<Task>(task ? `/app/tasks/${task.id}` : "/app/tasks", { method: task ? "PUT" : "POST", body }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorText error={error} />
      <Field label="Task" error={fieldError(error, "title")}><Input required value={f.title} onChange={set("title")} placeholder="Install base cabinets" /></Field>
      {!projectId && (
        <Field label="Project" error={fieldError(error, "project_id")}>
          <Select value={f.project_id} onChange={set("project_id")}>
            <option value="">— No project —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={fieldError(error, "status")}>
          <Select value={f.status} onChange={set("status")}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
        <Field label="Priority" error={fieldError(error, "priority")}>
          <Select value={f.priority} onChange={set("priority")}>{PRIORITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
        <Field label="Due date" error={fieldError(error, "due_date")}><Input type="date" value={f.due_date} onChange={set("due_date")} /></Field>
        <Field label="Assignee" error={fieldError(error, "assigned_to")}>
          <Select value={f.assigned_to} onChange={set("assigned_to")}>
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes" error={fieldError(error, "description")}><Textarea value={f.description} onChange={set("description")} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving}>{saving ? "Saving…" : task ? "Save changes" : "Add task"}</Button>
      </div>
    </form>
  );
}

/** Checkbox-style quick status toggle (todo/in_progress ⇄ done) via PATCH. */
export function TaskToggle({ task, disabled, onChange }: { task: Task; disabled?: boolean; onChange: (t: Task) => void }) {
  const [busy, setBusy] = useState(false);
  const done = task.status === "done";
  async function toggle() {
    setBusy(true);
    try {
      onChange(await crm<Task>(`/app/tasks/${task.id}/status`, { method: "PATCH", body: { status: done ? "todo" : "done" } }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <input
      type="checkbox" checked={done} disabled={disabled || busy} onChange={toggle} onClick={(e) => e.stopPropagation()}
      aria-label={done ? "Mark as not done" : "Mark as done"} className="h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-default"
    />
  );
}
