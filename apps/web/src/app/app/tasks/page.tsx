"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { can, crm, formatDate } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Link, Modal, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { MobileList, Pager, TASK_STATUSES, isOverdue, label, tone, useUsers, type Page, type Project, type Task } from "../projects/_crm/shared";
import { TaskForm, TaskToggle } from "../projects/_crm/forms";

function TasksPage() {
  const { me } = useSession();
  const params = useSearchParams();
  const manage = can(me, "tasks.manage");
  const users = useUsers();
  const projects = useFetch<Page<Project>>("/app/projects?per_page=100").data?.data ?? [];
  const [status, setStatus] = useState("open");
  const [projectId, setProjectId] = useState(params.get("project_id") ?? "");
  const [assignee, setAssignee] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), status, project_id: projectId });
  if (assignee === "me") qs.set("mine", "1");
  else if (assignee) qs.set("assigned_to", assignee);
  const { data, error, reload, setData } = useFetch<Page<Task>>(`/app/tasks?${qs}`);
  const [editing, setEditing] = useState<Task | "new" | null>(params.get("new") ? "new" : null);
  const [actionError, setActionError] = useState<unknown>(null);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  const replace = (t: Task) => data && setData({ ...data, data: data.data.map((x) => (x.id === t.id ? { ...x, ...t } : x)) });

  async function setTaskStatus(t: Task, s: string) {
    try {
      replace(await crm<Task>(`/app/tasks/${t.id}/status`, { method: "PATCH", body: { status: s } }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function remove(t: Task) {
    if (!confirm(`Delete task “${t.title}”?`)) return;
    try {
      await crm(`/app/tasks/${t.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Work to do across all your jobs." actions={manage && <Button onClick={() => setEditing("new")}>+ New task</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className="w-full sm:max-w-[10rem]">
            <option value="open">Open</option>
            <option value="">All statuses</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
          <Select value={projectId} onChange={(e) => reset(setProjectId)(e.target.value)} className="w-full sm:max-w-[16rem]">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={assignee} onChange={(e) => reset(setAssignee)(e.target.value)} className="w-full sm:max-w-[12rem]">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
        <ErrorText error={error || actionError} />
        {!data ? !error && <Spinner /> : (
          <>
            <MobileList
              rows={data.data}
              empty="No tasks match."
              render={(t) => (
                <div className="flex items-start gap-3">
                  <TaskToggle task={t} disabled={!manage} onChange={replace} />
                  <div className="min-w-0 flex-1">
                    <p className={t.status === "done" ? "truncate text-slate-400 line-through" : "truncate font-medium text-slate-900"}>{t.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      <span className={isOverdue(t) ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDate(t.due_date)}{isOverdue(t) && " · overdue"}</span>
                      {" · "}{t.project?.name ?? "No project"} · {t.assignee?.name ?? "Unassigned"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge tone={tone(t.priority)}>{label(t.priority)}</Badge>
                      {manage && (
                        <>
                          <Button variant="ghost" className="ml-auto px-2 py-1" onClick={() => setEditing(t)}>Edit</Button>
                          <Button variant="danger-ghost" className="px-2 py-1" onClick={() => remove(t)}>Delete</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            />
            <div className="hidden sm:block">
            <Table
              rows={data.data}
              empty="No tasks match."
              columns={[
                ["", (t) => <TaskToggle task={t} disabled={!manage} onChange={replace} />],
                ["Task", (t) => <span className={t.status === "done" ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{t.title}</span>],
                ["Project", (t) => (t.project ? <Link href={`/app/projects/${t.project.id}`} className="text-brand-700 hover:underline">{t.project.name}</Link> : "—")],
                ["Priority", (t) => <Badge tone={tone(t.priority)}>{label(t.priority)}</Badge>],
                ["Due", (t) => <span className={isOverdue(t) ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDate(t.due_date)}{isOverdue(t) && " · overdue"}</span>],
                ["Assignee", (t) => t.assignee?.name ?? "—"],
                ["Status", (t) => manage ? (
                  <Select value={t.status} onChange={(e) => setTaskStatus(t, e.target.value)} className="w-auto py-1 text-xs">
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </Select>
                ) : <Badge tone={tone(t.status)}>{label(t.status)}</Badge>],
                ["", (t) => manage && (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(t)}>Edit</Button>
                    <Button variant="danger-ghost" className="px-2 py-1" onClick={() => remove(t)}>Delete</Button>
                  </div>
                )],
              ]}
            />
            </div>
            <Pager page={data.current_page} last={data.last_page} onPage={setPage} />
          </>
        )}
      </Card>
      <Modal open={!!editing} title={editing === "new" ? "New task" : "Edit task"} onClose={() => setEditing(null)}>
        {editing && (
          <TaskForm
            key={editing === "new" ? "new" : editing.id}
            task={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><TasksPage /></Suspense>;
}

