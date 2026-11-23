"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { can, crm, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Card, ErrorText, Input, Link, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { StatusBadge } from "./StatusBadge";
import { ESTIMATE_STATUSES, INVOICE_STATUSES, type DocKind, type Paginated, type SalesDoc } from "./types";

/** Filterable, paginated list of estimates or invoices. */
export function DocumentList({ kind }: { kind: DocKind }) {
  const { me } = useSession();
  const router = useRouter();
  const path = kind === "invoice" ? "invoices" : "estimates";
  const statuses = kind === "invoice" ? INVOICE_STATUSES : ESTIMATE_STATUSES;
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Paginated<SalesDoc> | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    crm<Paginated<SalesDoc>>(`/app/${path}?${params}`).then(setRes).catch(setError);
  }, [path, page, status, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const title = kind === "invoice" ? "Invoices" : "Estimates";
  const columns: [string, (r: SalesDoc) => React.ReactNode][] = [
    ["Number", (r) => <span className="font-medium text-slate-900">{r.number}</span>],
    ["Customer", (r) => r.customer?.name ?? "—"],
    ["Project", (r) => r.project?.name ?? "—"],
    ["Issued", (r) => r.issue_date ?? "—"],
    [kind === "invoice" ? "Due" : "Valid until", (r) => (kind === "invoice" ? r.due_date : r.expiry_date) ?? "—"],
    ["Total", (r) => money(r.total)],
    ...(kind === "invoice" ? [["Balance", (r: SalesDoc) => money(r.balance ?? 0)] as [string, (r: SalesDoc) => React.ReactNode]] : []),
    ["Status", (r) => <StatusBadge status={r.status} overdue={r.is_overdue} />],
  ];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={kind === "invoice" ? "Bill clients and track payments." : "Quotes you send to clients."}
        actions={can(me, `${path}.manage`) && <Link href={`/app/${path}/new`}><Button>New {kind}</Button></Link>}
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search number or customer…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select className="max-w-[12rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status filter">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>
        <ErrorText error={error} />
        {!res ? <Spinner /> : (
          <>
            <Table rows={res.data} columns={columns} empty={`No ${path} yet.`} onRow={(r) => router.push(`/app/${path}/${r.id}`)} />
            {res.last_page > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-600">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span>Page {res.current_page} of {res.last_page}</span>
                <Button variant="secondary" disabled={page >= res.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
