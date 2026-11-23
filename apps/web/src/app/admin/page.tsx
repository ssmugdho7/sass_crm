"use client";

import { useRouter } from "next/navigation";
import { money } from "@/lib/api";
import { Card, ErrorText, PageHeader, Spinner, Stat, Table } from "@/components/ui";
import { StatusBadge, TENANT_STATUSES, date, useLoad, type Tenant } from "./_shared";

type Overview = {
  tenants: { total: number; by_status: Record<string, number> };
  users: number;
  mrr: number;
  signups_30d: number;
  recent_tenants: Tenant[];
};

export default function AdminOverviewPage() {
  const router = useRouter();
  const { data, error } = useLoad<Overview>("/platform/overview");
  if (error) return <ErrorText error={error} />;
  if (!data) return <Spinner />;

  return (
    <>
      <PageHeader title="Overview" subtitle="Platform health at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={money(data.mrr)} hint="Active accounts, yearly plans ÷ 12" />
        <Stat label="CRM accounts" value={data.tenants.total} />
        <Stat label="Users" value={data.users} />
        <Stat label="Sign-ups (30 days)" value={data.signups_30d} />
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
        <Card title="Recent sign-ups" className="lg:col-span-2">
          <Table
            rows={data.recent_tenants}
            onRow={(t) => router.push(`/admin/tenants/${t.id}`)}
            columns={[
              ["Account", (t) => <span className="font-medium text-slate-900">{t.name}</span>],
              ["Plan", (t) => t.plan?.name ?? "—"],
              ["Status", (t) => <StatusBadge status={t.status} />],
              ["Users", (t) => t.users_count ?? 0],
              ["Created", (t) => date(t.created_at)],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
