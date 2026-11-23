"use client";

import { useState } from "react";
import { money, platform } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Spinner, Table, Textarea, fieldError } from "@/components/ui";
import { toCents, toDollars, useLoad, type Plan } from "../_shared";

type Mod = { key: string; name: string; is_core: boolean };

export default function PlansPage() {
  const { data, error, reload } = useLoad<Plan[]>("/platform/plans");
  const { data: modules } = useLoad<Mod[]>("/platform/modules");
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  async function remove(p: Plan) {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    setActionError(null);
    try {
      await platform(`/platform/plans/${p.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <>
      <PageHeader title="Plans" subtitle="Subscription plans shown on the pricing page." actions={<Button onClick={() => setEditing("new")}>New plan</Button>} />
      <ErrorText error={error ?? actionError} />
      <Card>
        {!data ? <Spinner /> : (
          <Table
            rows={data}
            onRow={setEditing}
            columns={[
              ["Plan", (p) => <div><p className="font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.slug}</p></div>],
              ["Monthly", (p) => money(p.price_monthly)],
              ["Yearly", (p) => money(p.price_yearly)],
              ["Max users", (p) => p.max_users],
              ["Included add-ons", (p) => (p.included_modules?.length ? p.included_modules.join(", ") : "—")],
              ["Accounts", (p) => p.tenants_count ?? 0],
              ["Status", (p) => <Badge tone={p.is_active ? "green" : "gray"}>{p.is_active ? "active" : "hidden"}</Badge>],
              ["", (p) => (
                <Button variant="ghost" className="px-2 py-1 text-red-600" disabled={!!p.tenants_count}
                  title={p.tenants_count ? "In use" : "Delete"} onClick={(e) => { e.stopPropagation(); remove(p); }}>Delete</Button>
              )],
            ]}
          />
        )}
      </Card>
      <Modal open={!!editing} title={editing === "new" ? "New plan" : "Edit plan"} onClose={() => setEditing(null)}>
        {editing && (
          <PlanForm key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing}
            addons={(modules ?? []).filter((m) => !m.is_core)} onDone={() => { setEditing(null); reload(); }} />
        )}
      </Modal>
    </>
  );
}

function PlanForm({ plan, addons, onDone }: { plan: Plan | null; addons: Mod[]; onDone: () => void }) {
  const [form, setForm] = useState({
    name: plan?.name ?? "", slug: plan?.slug ?? "",
    price_monthly: plan ? toDollars(plan.price_monthly) : "0.00", price_yearly: plan ? toDollars(plan.price_yearly) : "0.00",
    max_users: String(plan?.max_users ?? 5), sort: String(plan?.sort ?? 0), is_active: plan?.is_active ?? true,
    included_modules: plan?.included_modules ?? [], features: (plan?.features ?? []).join("\n"),
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: "name" | "slug" | "price_monthly" | "price_yearly" | "max_users" | "sort" | "features") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const toggle = (key: string) =>
    setForm({ ...form, included_modules: form.included_modules.includes(key) ? form.included_modules.filter((k) => k !== key) : [...form.included_modules, key] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: form.name, slug: form.slug, price_monthly: toCents(form.price_monthly), price_yearly: toCents(form.price_yearly),
      max_users: Number(form.max_users), sort: Number(form.sort), is_active: form.is_active, included_modules: form.included_modules,
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
    };
    try {
      await platform(plan ? `/platform/plans/${plan.id}` : "/platform/plans", { method: plan ? "PUT" : "POST", body });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorText error={error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" error={fieldError(error, "name")}><Input value={form.name} onChange={set("name")} required /></Field>
        <Field label="Slug" error={fieldError(error, "slug")}><Input value={form.slug} onChange={set("slug")} required pattern="[a-z0-9-]+" /></Field>
        <Field label="Monthly price ($)" error={fieldError(error, "price_monthly")}><Input type="number" min="0" step="0.01" value={form.price_monthly} onChange={set("price_monthly")} /></Field>
        <Field label="Yearly price ($)" error={fieldError(error, "price_yearly")}><Input type="number" min="0" step="0.01" value={form.price_yearly} onChange={set("price_yearly")} /></Field>
        <Field label="Max users" error={fieldError(error, "max_users")}><Input type="number" min="1" value={form.max_users} onChange={set("max_users")} /></Field>
        <Field label="Sort order" error={fieldError(error, "sort")}><Input type="number" min="0" value={form.sort} onChange={set("sort")} /></Field>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Included add-ons</p>
        <div className="grid grid-cols-2 gap-1">
          {addons.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand-600" checked={form.included_modules.includes(m.key)} onChange={() => toggle(m.key)} />
              {m.name}
            </label>
          ))}
        </div>
        {fieldError(error, "included_modules.0") && <p className="text-xs text-red-600">{fieldError(error, "included_modules.0")}</p>}
      </div>
      <Field label="Features (one per line)" error={fieldError(error, "features")}><Textarea rows={4} value={form.features} onChange={set("features")} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-brand-600" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        Active (visible for sign-up)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button disabled={busy}>{busy ? "Saving…" : "Save plan"}</Button>
      </div>
    </form>
  );
}
