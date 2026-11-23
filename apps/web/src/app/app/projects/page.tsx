"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { can, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Input, Modal, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { MobileList, PROJECT_STATUSES, Pager, dateRange, label, tone, useDebounced, type Page, type Project } from "./_crm/shared";
import { ProjectForm } from "./_crm/forms";

function ProjectsPage() {
  const { me } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const manage = can(me, "projects.manage");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, error } = useFetch<Page<Project>>(`/app/projects?page=${page}&search=${encodeURIComponent(q)}&status=${status}`);
  const [creating, setCreating] = useState(!!params.get("new"));

  return (
    <div>
      <PageHeader title="Projects" subtitle="Your construction jobs, from planning to handover." actions={manage && <Button onClick={() => setCreating(true)}>+ New project</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Search name or site address…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:max-w-xs" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:max-w-[12rem]">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
        </div>
        <ErrorText error={error} />
        {!data ? !error && <Spinner /> : (
          <>
            <MobileList
              rows={data.data}
              empty="No projects match."
              onRow={(p) => router.push(`/app/projects/${p.id}`)}
              render={(p) => (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{p.name}</p>
                      <p className="truncate text-xs text-slate-500">{[p.customer?.name, p.site_address].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <Badge tone={tone(p.status)}>{label(p.status)}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{money(p.budget)} · {dateRange(p.start_date, p.due_date)} · {p.open_tasks_count ?? 0} open tasks</p>
                </div>
              )}
            />
            <div className="hidden sm:block">
              <Table
                rows={data.data}
                empty="No projects match."
                onRow={(p) => router.push(`/app/projects/${p.id}`)}
                columns={[
                  ["Project", (p) => (
                    <div className="min-w-[10rem]">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.site_address || "—"}</p>
                    </div>
                  )],
                  ["Customer", (p) => p.customer?.name ?? "—"],
                  ["Status", (p) => <Badge tone={tone(p.status)}>{label(p.status)}</Badge>],
                  ["Dates", (p) => <span className="whitespace-nowrap">{dateRange(p.start_date, p.due_date)}</span>],
                  ["Budget", (p) => money(p.budget)],
                  ["Manager", (p) => p.manager?.name ?? "—"],
                  ["Open tasks", (p) => `${p.open_tasks_count ?? 0} / ${p.tasks_count ?? 0}`],
                ]}
              />
            </div>
            <Pager page={data.current_page} last={data.last_page} onPage={setPage} />
          </>
        )}
      </Card>
      <Modal open={creating} title="New project" onClose={() => setCreating(false)}>
        {creating && <ProjectForm onCancel={() => setCreating(false)} onSaved={(p) => router.push(`/app/projects/${p.id}`)} />}
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ProjectsPage /></Suspense>;
}
