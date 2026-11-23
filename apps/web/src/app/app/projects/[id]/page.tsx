"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { can, crm, formatDate, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Link, Modal, PageHeader, Spinner, Table } from "@/components/ui";
import { MobileList, dateRange, isOverdue, label, tone, type Project, type Task } from "../_crm/shared";
import { ProjectForm, TaskForm, TaskToggle } from "../_crm/forms";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const manage = can(me, "projects.manage");
  const manageTasks = can(me, "tasks.manage");
  const { data: p, error, reload, setData } = useFetch<Project>(`/app/projects/${id}`);
  const [editing, setEditing] = useState(false);
  const [task, setTask] = useState<Task | "new" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  async function remove() {
    if (!p || !confirm(`Delete project “${p.name}” and its tasks? This cannot be undone.`)) return;
    try {
      await crm(`/app/projects/${p.id}`, { method: "DELETE" });
      router.push("/app/projects");
    } catch (e) {
      setActionError(e);
    }
  }

  if (error) return <ErrorText error={error} />;
  if (!p) return <Spinner />;
  const tasks = p.tasks ?? [];
  const done = tasks.filter((t) => t.status === "done").length;
  const replaceTask = (t: Task) => setData({ ...p, tasks: tasks.map((x) => (x.id === t.id ? { ...x, ...t } : x)) });

  return (
    <div>
      <Link href="/app/projects" className="text-sm text-slate-500 hover:underline">← Projects</Link>
      <PageHeader
        title={p.name}
        subtitle={p.site_address ?? undefined}
        actions={manage && (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger-ghost" onClick={remove}>Delete</Button>
          </>
        )}
      />
      <ErrorText error={actionError} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-slate-500">Status</dt><dd><Badge tone={tone(p.status)}>{label(p.status)}</Badge></dd></div>
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="text-slate-900">
                {p.customer ? (can(me, "customers.view") ? <Link href={`/app/customers/${p.customer.id}`} className="text-brand-700 hover:underline">{p.customer.name}</Link> : p.customer.name) : "—"}
              </dd>
            </div>
            <div><dt className="text-slate-500">Budget</dt><dd className="text-slate-900">{money(p.budget)}</dd></div>
            <div><dt className="text-slate-500">Schedule</dt><dd className="text-slate-900">{dateRange(p.start_date, p.due_date)}</dd></div>
            <div><dt className="text-slate-500">Project manager</dt><dd className="text-slate-900">{p.manager?.name ?? "—"}</dd></div>
            {p.description && <div><dt className="text-slate-500">Scope</dt><dd className="whitespace-pre-line text-slate-900">{p.description}</dd></div>}
          </dl>
        </Card>
        <Card
          title={`Tasks (${done}/${tasks.length} done)`}
          className="lg:col-span-2"
          actions={manageTasks && <Button variant="secondary" className="px-3 py-1" onClick={() => setTask("new")}>+ Add task</Button>}
        >
          {tasks.length > 0 && (
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-600" style={{ width: `${Math.round((done / tasks.length) * 100)}%` }} />
            </div>
          )}
          <MobileList
            rows={tasks}
            empty="No tasks yet."
            render={(t) => (
              <div className="flex items-start gap-3">
                <TaskToggle task={t} disabled={!manageTasks} onChange={replaceTask} />
                <button type="button" disabled={!manageTasks} onClick={() => setTask(t)} className="min-w-0 flex-1 text-left">
                  <p className={t.status === "done" ? "truncate text-slate-500 line-through" : "truncate font-medium text-slate-900"}>{t.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    <span className={isOverdue(t) ? "font-medium text-red-600" : ""}>{formatDate(t.due_date)}{isOverdue(t) && " · overdue"}</span>
                    {" · "}{t.assignee?.name ?? "Unassigned"} · {label(t.priority)}
                  </p>
                </button>
              </div>
            )}
          />
          <div className="hidden sm:block">
          <Table
            rows={tasks}
            empty="No tasks yet."
            onRow={manageTasks ? (t) => setTask(t) : undefined}
            columns={[
              ["", (t) => <TaskToggle task={t} disabled={!manageTasks} onChange={replaceTask} />],
              ["Task", (t) => <span className={t.status === "done" ? "text-slate-500 line-through" : "font-medium text-slate-900"}>{t.title}</span>],
              ["Priority", (t) => <Badge tone={tone(t.priority)}>{label(t.priority)}</Badge>],
              ["Due", (t) => <span className={isOverdue(t) ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDate(t.due_date)}</span>],
              ["Assignee", (t) => t.assignee?.name ?? "—"],
              ["Status", (t) => <Badge tone={tone(t.status)}>{label(t.status)}</Badge>],
            ]}
          />
          </div>
        </Card>
      </div>

      <Modal open={editing} title="Edit project" onClose={() => setEditing(false)}>
        {editing && <ProjectForm project={p} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      </Modal>
      <Modal open={!!task} title={task === "new" ? "Add task" : "Edit task"} onClose={() => setTask(null)}>
        {task && (
          <TaskForm
            key={task === "new" ? "new" : task.id}
            task={task === "new" ? null : task}
            projectId={p.id}
            onCancel={() => setTask(null)}
            onSaved={() => { setTask(null); reload(); }}
          />
        )}
      </Modal>
    </div>
  );
}
