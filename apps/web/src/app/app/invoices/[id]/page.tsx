"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { can, crm, formatDate, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Card, ErrorText, Link, PageHeader, Spinner, Stat, Table } from "@/components/ui";
import { DocumentEditor } from "@/components/sales/DocumentEditor";
import { RecordPaymentModal } from "@/components/sales/RecordPaymentModal";
import { StatusBadge } from "@/components/sales/StatusBadge";
import { useCopyLink } from "@/components/sales/useCopy";
import { PAYMENT_METHODS, type Payment, type SalesDoc } from "@/components/sales/types";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [doc, setDoc] = useState<SalesDoc | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paying, setPaying] = useState(false);
  const [copied, copy] = useCopyLink();
  const manage = can(me, "invoices.manage");

  const load = useCallback(() => {
    crm<SalesDoc>(`/app/invoices/${id}`).then(setDoc).catch(setError);
    crm<Payment[]>(`/app/invoices/${id}/payments`).then(setPayments).catch(() => setPayments([]));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const setStatus = (status: string) => {
    if (status === "void" && !window.confirm("Void this invoice? The client will no longer be able to pay it.")) return;
    run(async () => setDoc(await crm<SalesDoc>(`/app/invoices/${id}/status`, { method: "POST", body: { status } })));
  };
  const deletePayment = (p: Payment) => {
    if (!window.confirm(`Delete the ${money(p.amount)} payment?`)) return;
    run(async () => {
      const r = await crm<{ invoice: SalesDoc }>(`/app/invoices/${id}/payments/${p.id}`, { method: "DELETE" });
      setDoc(r.invoice);
      setPayments((ps) => ps.filter((x) => x.id !== p.id));
    });
  };
  const remove = () => {
    if (!window.confirm("Delete this invoice?")) return;
    run(async () => { await crm(`/app/invoices/${id}`, { method: "DELETE" }); router.push("/app/invoices"); });
  };

  if (!doc) return error ? <ErrorText error={error} /> : <Spinner />;
  const balance = doc.balance ?? 0;
  const isVoid = doc.status === "void";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Invoice ${doc.number}`}
        subtitle={doc.customer?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => copy(`/i/invoice/${doc.public_token}`)}>{copied ? "Link copied!" : "Copy client link"}</Button>
            <a href={`/i/invoice/${doc.public_token}`} target="_blank" rel="noreferrer"><Button variant="ghost">Preview</Button></a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total" value={money(doc.total)} />
        <Stat label="Paid" value={money(doc.amount_paid ?? 0)} />
        <Stat label="Balance due" value={money(balance)} hint={doc.is_overdue ? `Overdue since ${formatDate(doc.due_date)}` : doc.due_date ? `Due ${formatDate(doc.due_date)}` : undefined} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={doc.status} overdue={doc.is_overdue} />
        {doc.estimate_id && <Link href={`/app/estimates/${doc.estimate_id}`} className="text-sm text-brand-700 hover:underline">From estimate</Link>}
        {manage && (
          <>
            {!isVoid && balance > 0 && <Button disabled={busy} onClick={() => setPaying(true)}>Record payment</Button>}
            {doc.status === "draft" && <Button variant="secondary" disabled={busy} onClick={() => setStatus("sent")}>Mark as sent</Button>}
            {!isVoid && <Button variant="danger-ghost" disabled={busy} onClick={() => setStatus("void")}>Void</Button>}
            {isVoid && <Button variant="secondary" disabled={busy} onClick={() => setStatus("draft")}>Restore</Button>}
            {!payments.length && <Button variant="danger-ghost" className="ml-auto" disabled={busy} onClick={remove}>Delete</Button>}
          </>
        )}
      </div>
      <div className="mb-4 space-y-2">
        <ErrorText error={error} />
        {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Invoice saved.</p>}
      </div>

      <Card title="Payments" className="mb-6">
        <Table
          rows={payments}
          empty="No payments recorded yet."
          columns={[
            ["Date", (p) => formatDate(p.paid_at)],
            ["Amount", (p) => <span className="font-medium">{money(p.amount)}</span>],
            ["Method", (p) => PAYMENT_METHODS[p.method] ?? p.method],
            ["Reference", (p) => p.reference ?? "—"],
            ["", (p) => (manage ? <Button variant="danger-ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => deletePayment(p)} aria-label={`Delete ${money(p.amount)} payment`}>Delete</Button> : null)],
          ]}
        />
      </Card>

      <DocumentEditor
        key={version}
        kind="invoice"
        initial={doc}
        disabled={!manage || isVoid}
        submitLabel="Save changes"
        onSubmit={async (body) => {
          setDoc(await crm<SalesDoc>(`/app/invoices/${id}`, { method: "PUT", body }));
          setVersion((v) => v + 1);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
      />

      {paying && <RecordPaymentModal
        open
        invoiceId={doc.id}
        balance={balance}
        onClose={() => setPaying(false)}
        onRecorded={(invoice, payment) => {
          setDoc(invoice);
          setPayments((ps) => [payment, ...ps]);
          setPaying(false);
        }}
      />}
    </div>
  );
}
