"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDate, money } from "@/lib/api";
import { Button, ErrorText, Spinner } from "@/components/ui";
import { StatusBadge } from "./StatusBadge";
import type { DocKind } from "./types";

type PublicPayload = {
  document: {
    type: DocKind; number: string; status: string; issue_date: string | null; due_date?: string | null; expiry_date?: string | null;
    items: { description: string; quantity: number; unit_price: number; amount: number }[];
    tax_rate: number; subtotal: number; tax: number; total: number; amount_paid?: number; balance?: number; is_overdue?: boolean;
    notes: string | null; project: string | null; site_address: string | null;
  };
  business: { name: string; email: string | null; phone: string | null };
  customer: { name: string; email: string | null; phone: string | null; address: string | null; city: string | null } | null;
  can_pay_online: boolean;
};

/** Clean, printable client-facing invoice / estimate. */
export function PublicDocument({ kind, token, paid = false }: { kind: DocKind; token: string; paid?: boolean }) {
  const base = `/public/${kind === "invoice" ? "invoices" : "estimates"}/${encodeURIComponent(token)}`;
  const [data, setData] = useState<PublicPayload | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  const load = useCallback(() => api<PublicPayload>(base).then(setData).catch(setError), [base]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, after: (r: PublicPayload & { url?: string }) => void) => {
    setBusy(true);
    setActionError(null);
    try {
      after(await api<PublicPayload & { url?: string }>(path, { method: "POST" }));
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };
  const respond = (verb: "accept" | "decline") => {
    if (verb === "decline" && !window.confirm("Decline this estimate?")) return;
    act(`${base}/${verb}`, (r) => setData(r));
  };
  const payOnline = () => act(`${base}/checkout`, (r) => { if (r.url) window.location.href = r.url; });

  if (error) return <main className="mx-auto max-w-3xl p-8"><ErrorText error={error} /></main>;
  if (!data) return <Spinner />;
  const { document: d, business, customer } = data;
  const isInvoice = d.type === "invoice";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <style>{`@media print { @page { margin: 16mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-end gap-2">
        {isInvoice && data.can_pay_online && (d.balance ?? 0) > 0 && (
          <Button onClick={payOnline} disabled={busy}>{busy ? "Redirecting…" : `Pay ${money(d.balance ?? 0)} online`}</Button>
        )}
        {!isInvoice && ["draft", "sent"].includes(d.status) && (
          <>
            <Button onClick={() => respond("accept")} disabled={busy}>Accept estimate</Button>
            <Button variant="secondary" onClick={() => respond("decline")} disabled={busy}>Decline</Button>
          </>
        )}
        <Button variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <div className="no-print mx-auto max-w-3xl space-y-2">
        {paid && isInvoice && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            Thank you! Your payment was received. It may take a moment to appear on this invoice.
          </p>
        )}
        {!isInvoice && ["accepted", "declined"].includes(d.status) && (
          <p className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
            This estimate has been {d.status}. {d.status === "accepted" ? `${business.name} will be in touch shortly.` : ""}
          </p>
        )}
        <ErrorText error={actionError} />
      </div>

      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <p className="text-2xl font-bold text-slate-900">{business.name}</p>
            {business.email && <p className="text-sm text-slate-600">{business.email}</p>}
            {business.phone && <p className="text-sm text-slate-600">{business.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">{isInvoice ? "Invoice" : "Estimate"}</p>
            <p className="text-xl font-bold text-slate-900">{d.number}</p>
            <div className="mt-1"><StatusBadge status={d.status} overdue={d.is_overdue} /></div>
          </div>
        </header>

        <section className="grid gap-6 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{isInvoice ? "Bill to" : "Prepared for"}</p>
            {customer ? (
              <div className="text-slate-800">
                <p className="font-medium">{customer.name}</p>
                {customer.address && <p>{customer.address}{customer.city ? `, ${customer.city}` : ""}</p>}
                {customer.email && <p>{customer.email}</p>}
                {customer.phone && <p>{customer.phone}</p>}
              </div>
            ) : <p>—</p>}
            {d.project && <p className="mt-3 text-slate-600"><span className="font-medium">Project:</span> {d.project}{d.site_address ? ` — ${d.site_address}` : ""}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-y-1 sm:text-right">
            <dt className="text-slate-500">Issued</dt><dd className="text-slate-800">{formatDate(d.issue_date)}</dd>
            <dt className="text-slate-500">{isInvoice ? "Due" : "Valid until"}</dt>
            <dd className="text-slate-800">{formatDate(isInvoice ? d.due_date : d.expiry_date)}</dd>
          </dl>
        </section>

        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-slate-200 text-left text-xs uppercase text-slate-500">
            <tr><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Qty</th><th className="hidden py-2 text-right font-medium sm:table-cell print:table-cell">Unit price</th><th className="py-2 text-right font-medium">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.items.map((i, idx) => (
              <tr key={idx} className="break-inside-avoid">
                <td className="py-2.5 pr-4 text-slate-800">{i.description}</td>
                <td className="py-2.5 text-right text-slate-700">{i.quantity}</td>
                <td className="hidden py-2.5 text-right text-slate-700 sm:table-cell print:table-cell">{money(i.unit_price)}</td>
                <td className="py-2.5 text-right font-medium text-slate-900">{money(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-6 flex justify-end">
          <dl className="w-full space-y-1 text-sm sm:w-64">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{money(d.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tax ({d.tax_rate}%)</dt><dd>{money(d.tax)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold"><dt>Total</dt><dd>{money(d.total)}</dd></div>
            {isInvoice && (
              <>
                <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd>{money(d.amount_paid ?? 0)}</dd></div>
                <div className="flex justify-between text-base font-bold text-brand-700"><dt>Balance due</dt><dd>{money(d.balance ?? 0)}</dd></div>
              </>
            )}
          </dl>
        </div>

        {d.notes && (
          <section className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-700">
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Notes</p>
            <p className="whitespace-pre-line">{d.notes}</p>
          </section>
        )}
      </article>
    </main>
  );
}
