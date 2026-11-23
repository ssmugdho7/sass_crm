"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, ErrorText, Input, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { Pager, StatusBadge, TENANT_STATUSES, date, useLoad, type Paginated, type Tenant } from "../_shared";

export default function TenantsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const { data, error } = useLoad<Paginated<Tenant>>(`/platform/tenants?${qs}`);

  return (
    <>
      <PageHeader title="CRM Accounts" subtitle="Every construction business on the platform." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search name, slug, email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select className="max-w-[12rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
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
                ["Trial ends", (t) => date(t.trial_ends_at)],
                ["Created", (t) => date(t.created_at)],
              ]}
            />
            <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
