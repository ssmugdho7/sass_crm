"use client";

import { useRouter } from "next/navigation";
import { formatDate, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { Card, ErrorText, Link, PageHeader, Spinner, Stat, Table } from "@/components/ui";
import { StatusBadge, TENANT_STATUSES, type Tenant } from "./_shared";

type Overview = {
  tenants: { total: number; by_status: Record<string, number> };
  users: number;
  mrr: number;
  signups_30d: number;
  pending_plan_requests: number;
  pending_addon_requests: number;
  recent_tenants: Tenant[];
};

export default function AdminOverviewPage() {
  const router = useRouter();
  const { data, error } = useFetch<Overview>("/platform/overview", "platform");
  if (error) return <ErrorText error={error} />;
  if (!data) return <Spinner />;

  return (
    <>
      <PageHeader title="Overview" subtitle="Platform health at a glance." />
      {data.pending_plan_requests > 0 && (
        <Link href="/admin/tenants?pending=1" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <span><span className="font-semibold">{data.pending_plan_requests}</span> pending plan {data.pending_plan_requests === 1 ? "request" : "requests"} awaiting approval</span>
          <span className="font-medium">Review →</span>
        </Link>
      )}
      {data.pending_addon_requests > 0 && <Link href="/admin/tenants?pending=1" className="mb-4 block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{data.pending_addon_requests} paid add-on requests awaiting confirmation — Review →</Link>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="MRR" value={money(data.mrr)} hint="Active accounts, yearly plans ÷ 12" />
        <Stat label="CRM accounts" value={data.tenants.total} />
        <Stat label="Users" value={data.users} />
        <Stat label="Sign-ups (30 days)" value={data.signups_30d} />
        <Link href="/admin/tenants?pending=1" className="block rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
          <Stat label="Pending plan requests" value={data.pending_plan_requests} hint="Approve after payment" />
        </Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Accounts by status">
          <ul className="space-y-2 text-sm">
            {TENANT_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between">
                <StatusBadge status={s} />
                <span className="font-semibold text-slate-900">{data.tenants.by_status[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent sign-ups" className="min-w-0 lg:col-span-2 max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(4)]:hidden">
          <Table
            rows={data.recent_tenants}
            onRow={(t) => router.push(`/admin/tenants/${t.id}`)}
            columns={[
              ["Account", (t) => <span className="font-medium text-slate-900">{t.name}</span>],
              ["Plan", (t) => t.plan?.name ?? "—"],
              ["Status", (t) => <StatusBadge status={t.status} />],
              ["Users", (t) => t.users_count ?? 0],
              ["Created", (t) => <span className="whitespace-nowrap">{formatDate(t.created_at)}</span>],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
