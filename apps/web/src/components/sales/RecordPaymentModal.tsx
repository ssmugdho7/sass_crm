"use client";

import { useState } from "react";
import { crm, money, toCents, toDollars } from "@/lib/api";
import { Button, ErrorText, Field, Input, Modal, Select, fieldError } from "@/components/ui";
import { PAYMENT_METHODS, type Payment, type SalesDoc } from "./types";

/** Mount only while open (state initialises from the current balance). */
const MANUAL = ["cash", "bank_transfer", "check", "card"];

export function RecordPaymentModal({ open, invoiceId, balance, onClose, onRecorded }: {
  open: boolean;
  invoiceId: number;
  balance: number;
  onClose: () => void;
  onRecorded: (invoice: SalesDoc, payment: Payment) => void;
}) {
  const [amount, setAmount] = useState(toDollars(balance));
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const cents = toCents(amount) ?? 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await crm<{ payment: Payment; invoice: SalesDoc }>(`/app/invoices/${invoiceId}/payments`, {
        method: "POST", body: { amount: cents, method, reference: reference || null },
      });
      onRecorded(r.invoice, r.payment);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Record payment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorText error={error} />
        <Field label={`Amount ($) — balance ${money(balance)}`} error={fieldError(error, "amount")}>
          <Input type="number" min="0.01" step="0.01" max={toDollars(balance)} value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <Field label="Method" error={fieldError(error, "method")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {MANUAL.map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m]}</option>)}
          </Select>
        </Field>
        <Field label="Reference (optional)" error={fieldError(error, "reference")}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, transfer ID…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || cents <= 0 || cents > balance}>{busy ? "Saving…" : `Record ${money(cents)}`}</Button>
        </div>
      </form>
    </Modal>
  );
}
