"use client";

import { useState } from "react";
import { can, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Card, ErrorText, Link, PageHeader, Spinner, Stat } from "@/components/ui";
import { isOverdue, label, tone, useFetch, type Lead, type Task } from "./projects/_crm/shared";

type Dashboard = {
  stats: {
    open_leads: number; pipeline_value: number; active_projects: number; open_tasks: number;
    overdue_tasks: number; unpaid_invoices: number; revenue_this_month: number;
  };
  recent_leads: Lead[];
  upcoming_tasks: Task[];
  projects_by_status: Record<string, number>;
};

const STATUS_ORDER = ["planning", "in_progress", "on_hold", "completed", "cancelled"];

function TrialBanner() {
  const { me } = useSession();
  const [now] = useState(() => Date.now());
  const t = me?.tenant;
  if (!t || t.status !== "trial" || !t.trial_ends_at) return null;
  const days = Math.max(0, Math.ceil((new Date(t.trial_ends_at).getTime() - now) / 86_400_000));
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm text-brand-800">
      <span>
        You&apos;re on a free trial — <strong>{days} {days === 1 ? "day" : "days"} left</strong> (ends {new Date(t.trial_ends_at).toLocaleDateString()}).
      </span>
      {can(me, "team.manage") && <Link href="/app/billing" className="font-medium underline">Choose a plan</Link>}
    </div>
  );
}

export default function DashboardPage() {
  const { me } = useSession();
  const { data, error } = useFetch<Dashboard>("/app/dashboard");

  const quick = [
    { href: "/app/leads?new=1", text: "+ New lead", perm: "leads.manage" },
    { href: "/app/projects?new=1", text: "+ New project", perm: "projects.manage" },
    { href: "/app/tasks?new=1", text: "+ New task", perm: "tasks.manage" },
    { href: "/app/customers?new=1", text: "+ New customer", perm: "customers.manage" },
  ].filter((q) => can(me, q.perm));

  return (
    <div>
      <PageHeader title={`Welcome${me ? `, ${me.name.split(" ")[0]}` : ""}`} subtitle="Here's what's happening across your jobs." />
      <TrialBanner />
      <ErrorText error={error} />
      {!data ? (
        !error && <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Open leads" value={data.stats.open_leads} hint={`${money(data.stats.pipeline_value)} in pipeline`} />
            <Stat label="Active projects" value={data.stats.active_projects} hint="Planning or in progress" />
            <Stat label="Open tasks" value={data.stats.open_tasks} hint={data.stats.overdue_tasks ? `${data.stats.overdue_tasks} overdue` : "None overdue"} />
            <Stat label="Revenue this month" value={money(data.stats.revenue_this_month)} hint={`${money(data.stats.unpaid_invoices)} unpaid`} />
          </div>

          {quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <Link key={q.href} href={q.href} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">{q.text}</Link>
              ))}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {can(me, "leads.view") && (
              <Card title="Recent leads" actions={<Link href="/app/leads" className="text-sm text-brand-700 hover:underline">View all</Link>}>
                {data.recent_leads.length ? (
                  <ul className="divide-y divide-slate-100">
                    {data.recent_leads.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{l.name}</p>
                          <p className="truncate text-xs text-slate-500">{l.service || "—"} · {label(l.source)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-slate-600">{money(l.value)}</span>
                          <Badge tone={tone(l.status)}>{label(l.status)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">No leads yet.</p>}
              </Card>
            )}

            <Card title="Upcoming tasks" actions={can(me, "tasks.view") && <Link href="/app/tasks" className="text-sm text-brand-700 hover:underline">View all</Link>}>
              {data.upcoming_tasks.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.upcoming_tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{t.title}</p>
                        <p className="truncate text-xs text-slate-500">{t.project?.name ?? "No project"}</p>
                      </div>
                      <span className={isOverdue(t) ? "shrink-0 font-medium text-red-600" : "shrink-0 text-slate-600"}>
                        {t.due_date}{isOverdue(t) && " · overdue"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Nothing scheduled.</p>}
            </Card>

            <Card title="Projects by status" actions={can(me, "projects.view") && <Link href="/app/projects" className="text-sm text-brand-700 hover:underline">View all</Link>}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {STATUS_ORDER.map((s) => (
                  <Link key={s} href={`/app/projects?status=${s}`} className="rounded-lg border border-slate-200 p-3 text-center hover:bg-slate-50">
                    <p className="text-xl font-bold text-slate-900">{data.projects_by_status[s] ?? 0}</p>
                    <p className="text-xs text-slate-500">{label(s)}</p>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
