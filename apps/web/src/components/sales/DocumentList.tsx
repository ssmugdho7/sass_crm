"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { can, formatDate, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Button, Card, EmptyState, ErrorText, Input, Link, PageHeader, Select, Spinner, Table, statusLabel } from "@/components/ui";
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
  const [search, setSearch] = useState(""); // debounced q
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  if (search) params.set("q", search);
  const { data: res, error } = useFetch<Paginated<SalesDoc>>(`/app/${path}?${params}`);

  const title = kind === "invoice" ? "Invoices" : "Estimates";
  const canManage = can(me, `${path}.manage`);
  const filtered = !!status || !!search;
  const empty = filtered ? (
    <EmptyState title="No matches" hint="Try a different search or status filter." action={
      <Button variant="secondary" onClick={() => { setQ(""); setSearch(""); setStatus(""); setPage(1); }}>Clear filters</Button>
    } />
  ) : (
    <EmptyState
      icon={kind === "invoice" ? "💵" : "📝"}
      title={kind === "invoice" ? "Create your first invoice" : "Create your first estimate"}
      hint={kind === "invoice" ? "Bill your client and let them pay online — payments update the balance automatically." : "Send a professional quote your client can accept online."}
      action={canManage && <Link href={`/app/${path}/new`}><Button>{kind === "invoice" ? "Create invoice" : "Create estimate"}</Button></Link>}
    />
  );
  const columns: [string, (r: SalesDoc) => React.ReactNode][] = [
    ["Number", (r) => <span className="font-medium text-slate-900">{r.number}</span>],
    ["Customer", (r) => r.customer?.name ?? "—"],
    ["Project", (r) => r.project?.name ?? "—"],
    ["Issued", (r) => formatDate(r.issue_date)],
    [kind === "invoice" ? "Due" : "Valid until", (r) => formatDate(kind === "invoice" ? r.due_date : r.expiry_date)],
    ["Total", (r) => money(r.total)],
    ...(kind === "invoice" ? [["Balance", (r: SalesDoc) => money(r.balance ?? 0)] as [string, (r: SalesDoc) => React.ReactNode]] : []),
    ["Status", (r) => <StatusBadge status={r.status} overdue={r.is_overdue} />],
  ];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={kind === "invoice" ? "Bill clients and track payments." : "Quotes you send to clients."}
        actions={canManage && <Link href={`/app/${path}/new`}><Button>New {kind}</Button></Link>}
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="w-full sm:max-w-xs" placeholder="Search number or customer…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select className="w-full sm:max-w-[12rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status filter">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        </div>
        <ErrorText error={error} />
        {!res ? <Spinner /> : (
          <>
            {/* Small screens: stacked cards instead of a wide table. */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {!res.data.length && <li>{empty}</li>}
              {res.data.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/${path}/${r.id}`} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{r.number}</span>
                      <StatusBadge status={r.status} overdue={r.is_overdue} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-600">
                      <span className="truncate">{r.customer?.name ?? "—"}</span>
                      <span className="shrink-0 font-medium text-slate-800">{money(kind === "invoice" ? (r.balance ?? 0) : r.total)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {kind === "invoice" ? `Due ${formatDate(r.due_date)}` : `Issued ${formatDate(r.issue_date)}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block">
              <Table rows={res.data} columns={columns} empty={empty} onRow={(r) => router.push(`/app/${path}/${r.id}`)} />
            </div>
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
