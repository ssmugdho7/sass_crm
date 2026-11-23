"use client";

import { useEffect, useMemo, useState } from "react";
import { crm, money, toCents, toDollars } from "@/lib/api";
import { Button, Card, ErrorText, Field, Input, Select, Textarea, fieldError } from "@/components/ui";
import { calcTotals, type DocKind, type SalesDoc } from "./types";

type Option = { id: number; name: string; customer_id?: number | null };
type Row = { key: number; description: string; quantity: string; price: string };

export type DocumentPayload = {
  customer_id: number;
  project_id: number | null;
  issue_date: string | null;
  expiry_date?: string | null;
  due_date?: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
  tax_rate: number;
  notes: string | null;
};

let seq = 0;
const blankRow = (): Row => ({ key: ++seq, description: "", quantity: "1", price: "" });

/** Shared estimate/invoice editor. Prices typed in dollars, sent as integer cents. */
export function DocumentEditor({ kind, initial, onSubmit, submitLabel, disabled }: {
  kind: DocKind;
  initial?: SalesDoc | null;
  onSubmit: (payload: DocumentPayload) => Promise<void>;
  submitLabel: string;
  disabled?: boolean;
}) {
  const dateField = kind === "invoice" ? "due_date" : "expiry_date";
  const [customers, setCustomers] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [pickerError, setPickerError] = useState(false);
  const [customerId, setCustomerId] = useState(initial?.customer_id ? String(initial.customer_id) : "");
  const [projectId, setProjectId] = useState(initial?.project_id ? String(initial.project_id) : "");
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState((kind === "invoice" ? initial?.due_date : initial?.expiry_date) ?? "");
  const [taxRate, setTaxRate] = useState(initial ? String(initial.tax_rate ?? 0) : "0");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.items?.length
      ? initial.items.map((i) => ({ key: ++seq, description: i.description, quantity: String(i.quantity), price: toDollars(i.unit_price) }))
      : [blankRow()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    crm<{ data: Option[] }>("/app/customers?per_page=100")
      .then((r) => setCustomers(r.data ?? []))
      .catch(() => setPickerError(true));
    crm<{ data: Option[] }>("/app/projects?per_page=100")
      .then((r) => setProjects(r.data ?? []))
      .catch(() => setProjects([]));
  }, []);

  // Keep the current customer selectable even if the list failed to load.
  const customerOptions = useMemo(() => {
    const list = [...customers];
    if (initial?.customer && !list.some((c) => c.id === initial.customer!.id)) list.unshift({ id: initial.customer.id, name: initial.customer.name });
    return list;
  }, [customers, initial]);
  const projectOptions = useMemo(() => {
    const list = projects.filter((p) => !customerId || !p.customer_id || String(p.customer_id) === customerId);
    if (initial?.project && !list.some((p) => p.id === initial.project!.id)) list.unshift({ id: initial.project.id, name: initial.project.name });
    return list;
  }, [projects, customerId, initial]);

  const items = rows.map((r) => ({ description: r.description, quantity: Number(r.quantity) || 0, unit_price: toCents(r.price) ?? 0 }));
  const totals = calcTotals(items, Number(taxRate));
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        customer_id: Number(customerId),
        project_id: projectId ? Number(projectId) : null,
        issue_date: issueDate || null,
        [dateField]: endDate || null,
        items: items.filter((i, idx) => i.description.trim() || rows[idx].price),
        tax_rate: Number(taxRate) || 0,
        notes: notes || null,
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <ErrorText error={error} />
      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer" error={fieldError(error, "customer_id")}>
            {pickerError && !customerOptions.length ? (
              <Input type="number" placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required disabled={disabled} />
            ) : (
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required disabled={disabled}>
                <option value="">Select a customer…</option>
                {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Project / job (optional)" error={fieldError(error, "project_id")}>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={disabled}>
              <option value="">No project</option>
              {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Issue date" error={fieldError(error, "issue_date")}>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={disabled} />
          </Field>
          <Field label={kind === "invoice" ? "Due date" : "Valid until"} error={fieldError(error, dateField)}>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={disabled} />
          </Field>
        </div>
      </Card>

      <Card title="Line items">
        {fieldError(error, "items") && <p className="mb-3 text-sm text-red-600">{fieldError(error, "items")}</p>}
        <div className="hidden grid-cols-12 gap-3 px-1 pb-2 text-xs font-medium uppercase text-slate-500 sm:grid">
          <span className="col-span-6">Description</span><span className="col-span-2">Qty</span><span className="col-span-2">Unit price ($)</span><span className="col-span-2 text-right">Amount</span>
        </div>
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={r.key} className="grid grid-cols-12 items-center gap-3">
              <Input className="col-span-12 sm:col-span-6" placeholder="e.g. Framing labour" value={r.description} aria-label="Description"
                onChange={(e) => update(r.key, { description: e.target.value })} disabled={disabled} />
              <Input className="col-span-4 sm:col-span-2" type="number" min="0" step="any" value={r.quantity} aria-label="Quantity"
                onChange={(e) => update(r.key, { quantity: e.target.value })} disabled={disabled} />
              <Input className="col-span-4 sm:col-span-2" type="number" min="0" step="0.01" placeholder="0.00" value={r.price} aria-label="Unit price"
                onChange={(e) => update(r.key, { price: e.target.value })} disabled={disabled} />
              <div className="col-span-4 flex items-center justify-end gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-800">{money(totals.lines[idx])}</span>
                {!disabled && rows.length > 1 && (
                  <button type="button" aria-label="Remove line" className="text-slate-500 hover:text-red-600" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!disabled && <Button type="button" variant="ghost" className="mt-3" onClick={() => setRows((rs) => [...rs, blankRow()])}>+ Add line</Button>}

        <div className="mt-6 flex flex-col items-end gap-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex w-64 justify-between"><span className="text-slate-500">Subtotal</span><span>{money(totals.subtotal)}</span></div>
          <div className="flex w-64 items-center justify-between gap-2">
            <span className="text-slate-500">Tax</span>
            <span className="flex items-center gap-1">
              <Input className="w-20 py-1 text-right" type="number" min="0" max="100" step="0.01" value={taxRate} aria-label="Tax rate %"
                onChange={(e) => setTaxRate(e.target.value)} disabled={disabled} />%
            </span>
            <span>{money(totals.tax)}</span>
          </div>
          <div className="flex w-64 justify-between text-base font-bold text-slate-900"><span>Total</span><span>{money(totals.total)}</span></div>
        </div>
      </Card>

      <Card title="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms, scope, exclusions…" disabled={disabled} />
      </Card>

      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
        </div>
      )}
    </form>
  );
}
