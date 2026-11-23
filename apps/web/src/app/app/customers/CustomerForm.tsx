"use client";

import { useState } from "react";
import { crm } from "@/lib/api";
import { Button, ErrorText, Field, Input, Select, Textarea, fieldError } from "@/components/ui";
import { orNull, type Customer } from "../projects/_crm/shared";

export function CustomerForm({ customer, onSaved, onCancel }: { customer: Customer | null; onSaved: (c: Customer) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    type: customer?.type ?? "individual", name: customer?.name ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "",
    address: customer?.address ?? "", city: customer?.city ?? "", notes: customer?.notes ?? "",
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { type: f.type, name: f.name, email: orNull(f.email), phone: orNull(f.phone), address: orNull(f.address), city: orNull(f.city), notes: orNull(f.notes) };
      onSaved(await crm<Customer>(customer ? `/app/customers/${customer.id}` : "/app/customers", { method: customer ? "PUT" : "POST", body }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorText error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fieldError(error, "name")}><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Type" error={fieldError(error, "type")}>
          <Select value={f.type} onChange={set("type")}><option value="individual">Individual</option><option value="company">Company</option></Select>
        </Field>
        <Field label="Email" error={fieldError(error, "email")}><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone" error={fieldError(error, "phone")}><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Address" error={fieldError(error, "address")}><Input value={f.address} onChange={set("address")} /></Field>
        <Field label="City" error={fieldError(error, "city")}><Input value={f.city} onChange={set("city")} /></Field>
      </div>
      <Field label="Notes" error={fieldError(error, "notes")}><Textarea value={f.notes} onChange={set("notes")} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving}>{saving ? "Saving…" : customer ? "Save changes" : "Create customer"}</Button>
      </div>
    </form>
  );
}
