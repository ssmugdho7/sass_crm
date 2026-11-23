"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { can } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Button, Card, ErrorText, Input, Modal, PageHeader, Spinner, Table } from "@/components/ui";
import { ListEmpty, MobileList, Pager, label, useDebounced, type Customer, type Page } from "../projects/_crm/shared";
import { CustomerForm } from "./CustomerForm";

function CustomersPage() {
  const { me } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const manage = can(me, "customers.manage");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, error } = useFetch<Page<Customer>>(`/app/customers?page=${page}&search=${encodeURIComponent(q)}`);
  const [creating, setCreating] = useState(!!params.get("new"));

  return (
    <div>
      <PageHeader title="Customers" subtitle="Homeowners and businesses you work for." actions={manage && <Button onClick={() => setCreating(true)}>+ New customer</Button>} />
      <Card>
        <Input placeholder="Search customers…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="mb-4 w-full sm:max-w-xs" />
        <ErrorText error={error} />
        {!data ? !error && <Spinner /> : data.data.length === 0 ? (
          <ListEmpty
            filtered={!!q}
            noun="customers"
            onClear={() => { setSearch(""); setPage(1); }}
            icon="🏠"
            title="No customers yet"
            hint="Add homeowners and businesses you work for, or convert a won lead into a customer."
            action={manage && <Button onClick={() => setCreating(true)}>+ Add a customer</Button>}
          />
        ) : (
          <>
            <MobileList
              rows={data.data}
              onRow={(c) => router.push(`/app/customers/${c.id}`)}
              render={(c) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-xs text-slate-500">{[c.phone, c.email, c.city].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{c.projects_count ?? 0} {c.projects_count === 1 ? "project" : "projects"}</span>
                </div>
              )}
            />
            <div className="hidden sm:block">
              <Table
                rows={data.data}
                onRow={(c) => router.push(`/app/customers/${c.id}`)}
                columns={[
                  ["Name", (c) => <span className="font-medium text-slate-900">{c.name}</span>],
                  ["Type", (c) => label(c.type)],
                  ["Contact", (c) => [c.email, c.phone].filter(Boolean).join(" · ") || "—"],
                  ["Location", (c) => [c.address, c.city].filter(Boolean).join(", ") || "—"],
                  ["Projects", (c) => c.projects_count ?? 0],
                ]}
              />
            </div>
            <Pager page={data.current_page} last={data.last_page} onPage={setPage} />
          </>
        )}
      </Card>
      <Modal open={creating} title="New customer" onClose={() => setCreating(false)}>
        {creating && <CustomerForm customer={null} onCancel={() => setCreating(false)} onSaved={(c) => router.push(`/app/customers/${c.id}`)} />}
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><CustomersPage /></Suspense>;
}
