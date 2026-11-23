"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { can, crm, formatDate, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Link, Modal, PageHeader, Spinner, Stat, Table } from "@/components/ui";
import { label, tone, type Customer, type Project } from "../../projects/_crm/shared";
import { ProjectForm } from "../../projects/_crm/forms";
import { CustomerForm } from "../CustomerForm";

type Invoice = { id: number; number: string; status: string; issue_date: string; due_date: string | null; total: number; amount_paid: number };
type Detail = {
  customer: Customer;
  projects: Project[];
  invoices: Invoice[];
  invoice_summary: { count: number; total: number; paid: number; outstanding: number };
};

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const manage = can(me, "customers.manage");
  const { data, error, reload } = useFetch<Detail>(`/app/customers/${id}`);
  const [editing, setEditing] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  async function remove() {
    if (!data || !confirm(`Delete customer “${data.customer.name}”? This cannot be undone.`)) return;
    try {
      await crm(`/app/customers/${id}`, { method: "DELETE" });
      router.push("/app/customers");
    } catch (e) {
      setActionError(e);
    }
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return <Spinner />;
  const c = data.customer;

  return (
    <div>
      <Link href="/app/customers" className="text-sm text-slate-500 hover:underline">← Customers</Link>
      <PageHeader
        title={c.name}
        subtitle={label(c.type)}
        actions={manage && (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger-ghost" onClick={remove}>Delete</Button>
          </>
        )}
      />
      <ErrorText error={actionError} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Contact">
          <dl className="space-y-2 text-sm">
            {[["Email", c.email], ["Phone", c.phone], ["Address", [c.address, c.city].filter(Boolean).join(", ")]].map(([k, v]) => (
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="text-slate-900">{v || "—"}</dd></div>
            ))}
            {c.notes && <div><dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-line text-slate-900">{c.notes}</dd></div>}
          </dl>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <Stat label="Invoiced" value={money(data.invoice_summary.total)} hint={`${data.invoice_summary.count} invoices`} />
          <Stat label="Paid" value={money(data.invoice_summary.paid)} />
          <Stat label="Outstanding" value={money(data.invoice_summary.outstanding)} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Projects" actions={can(me, "projects.manage") && <Button variant="secondary" className="px-3 py-1" onClick={() => setAddingProject(true)}>+ Project</Button>}>
          <Table
            rows={data.projects}
            empty="No projects for this customer."
            onRow={can(me, "projects.view") ? (p) => router.push(`/app/projects/${p.id}`) : undefined}
            columns={[
              ["Project", (p) => <span className="font-medium text-slate-900">{p.name}</span>],
              ["Status", (p) => <Badge tone={tone(p.status)}>{label(p.status)}</Badge>],
              ["Budget", (p) => money(p.budget)],
            ]}
          />
        </Card>
        <Card title="Invoices">
          <Table
            rows={data.invoices}
            empty="No invoices yet."
            onRow={can(me, "invoices.view") ? (i) => router.push(`/app/invoices/${i.id}`) : undefined}
            columns={[
              ["Number", (i) => i.number],
              ["Issued", (i) => <span className="whitespace-nowrap">{formatDate(i.issue_date)}</span>],
              ["Status", (i) => <Badge tone={tone(i.status)}>{label(i.status)}</Badge>],
              ["Total", (i) => money(i.total)],
              ["Balance", (i) => money(Math.max(0, i.total - i.amount_paid))],
            ]}
          />
        </Card>
      </div>

      <Modal open={editing} title="Edit customer" onClose={() => setEditing(false)}>
        {editing && <CustomerForm customer={c} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      </Modal>
      <Modal open={addingProject} title="New project" onClose={() => setAddingProject(false)}>
        {addingProject && <ProjectForm customerId={c.id} onCancel={() => setAddingProject(false)} onSaved={(p) => router.push(`/app/projects/${p.id}`)} />}
      </Modal>
    </div>
  );
}
