"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { Card, ErrorText, Input, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { Pager, StatusBadge, TENANT_STATUSES, type Paginated, type Tenant } from "../_shared";

export default function TenantsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const { data, error } = useFetch<Paginated<Tenant>>(`/platform/tenants?${qs}`, "platform");

  return (
    <>
      <PageHeader title="CRM Accounts" subtitle="Every construction business on the platform." />
      <Card className="max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(3)]:hidden max-sm:[&_:is(th,td):nth-child(n+5)]:hidden">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="sm:max-w-xs" placeholder="Search name, slug, email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select className="sm:max-w-[12rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {TENANT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </Select>
        </div>
        <ErrorText error={error} />
        {!data ? <Spinner /> : (
          <>
            <Table
              rows={data.data}
              empty="No accounts match."
              onRow={(t) => router.push(`/admin/tenants/${t.id}`)}
              columns={[
                ["Account", (t) => <div><p className="font-medium text-slate-900">{t.name}</p><p className="text-xs text-slate-500">/{t.slug}</p></div>],
                ["Owner", (t) => t.owner ? <div><p>{t.owner.name}</p><p className="text-xs text-slate-500">{t.owner.email}</p></div> : "—"],
                ["Plan", (t) => t.plan?.name ?? "—"],
                ["Status", (t) => <StatusBadge status={t.status} />],
                ["Users", (t) => t.users_count ?? 0],
                ["Trial ends", (t) => <span className="whitespace-nowrap">{formatDate(t.trial_ends_at)}</span>],
                ["Created", (t) => <span className="whitespace-nowrap">{formatDate(t.created_at)}</span>],
              ]}
            />
            <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
