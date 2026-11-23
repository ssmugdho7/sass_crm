"use client";

import { useState } from "react";
import { formatDate } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { Card, ErrorText, Input, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { Pager, StatusBadge, UserEditModal, type AdminUser, type Paginated } from "../_shared";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const qs = new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const { data, error, reload } = useFetch<Paginated<AdminUser>>(`/platform/users?${qs}`, "platform");

  return (
    <>
      <PageHeader title="Users" subtitle="All CRM users across accounts." />
      <Card className="max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(3)]:hidden max-sm:[&_:is(th,td):nth-child(5)]:hidden">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="sm:max-w-xs" placeholder="Search name, email, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select className="sm:max-w-[10rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <ErrorText error={error} />
        {!data ? <Spinner /> : (
          <>
            <Table
              rows={data.data}
              empty="No users match."
              onRow={setEditing}
              columns={[
                ["User", (u) => <div><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p><p className="text-xs text-slate-500 sm:hidden">{u.tenant?.name}</p></div>],
                ["Account", (u) => u.tenant?.name ?? "—"],
                ["Role", (u) => u.role?.name ?? "—"],
                ["Status", (u) => <StatusBadge status={u.status} />],
                ["Last login", (u) => <span className="whitespace-nowrap">{formatDate(u.last_login_at, true)}</span>],
              ]}
            />
            <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
      <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </>
  );
}
