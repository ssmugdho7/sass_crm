"use client";

import { useState } from "react";
import { Card, ErrorText, Input, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { Pager, StatusBadge, UserEditModal, date, useLoad, type AdminUser, type Paginated } from "../_shared";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const qs = new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const { data, error, reload } = useLoad<Paginated<AdminUser>>(`/platform/users?${qs}`);

  return (
    <>
      <PageHeader title="Users" subtitle="All CRM users across accounts." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search name, email, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select className="max-w-[10rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
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
                ["User", (u) => <div><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></div>],
                ["Account", (u) => u.tenant?.name ?? "—"],
                ["Role", (u) => u.role?.name ?? "—"],
                ["Status", (u) => <StatusBadge status={u.status} />],
                ["Last login", (u) => date(u.last_login_at)],
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
