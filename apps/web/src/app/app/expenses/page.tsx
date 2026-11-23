"use client";

import { useState } from "react";
import { crm, can, formatDate, money, toCents, toDollars } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, fieldError } from "@/components/ui";
import { idOrNull, useLookups, ymd, type Paginated } from "../appointments/_ops/shared";

const CATEGORIES = ["materials", "labour", "equipment", "permits", "subcontractor", "other"] as const;
type Category = (typeof CATEGORIES)[number];

type Expense = {
  id: number;
  project_id: number | null;
  category: Category;
  vendor: string | null;
  description: string | null;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  project?: { id: number; name: string } | null;
};
type ExpensePage = Paginated<Expense> & { total_amount: number; by_category: Partial<Record<Category, number>> };
type Costing = {
  project: { id: number; name: string; status: string };
  budget: number;
  expenses_total: number;
  expenses_by_category: Partial<Record<Category, number>>;
  subcontractor_total: number;
  subcontractors: number;
  labour_hours: number;
  labour_cost: number;
  total_cost: number;
  profit_estimate: number;
  margin_percent: number | null;
  budget_used_percent: number | null;
};

const blank = () => ({ project_id: "", category: "materials" as Category, vendor: "", description: "", amount: "", expense_date: ymd(new Date()), receipt_url: "" });
type Form = ReturnType<typeof blank>;

function CostingPanel({ c }: { c: Costing }) {
  const pct = Math.min(100, c.budget_used_percent ?? 0);
  const over = c.profit_estimate < 0;
  const bars: [string, number, string][] = [
    ["Expenses", c.expenses_total, "bg-brand-500"],
    ["Subcontractors", c.subcontractor_total, "bg-sky-500"],
    ["Labour (timesheets)", c.labour_cost, "bg-emerald-500"],
  ];
  return (
    <Card title={`Job costing — ${c.project.name}`} className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Budget" value={money(c.budget)} />
        <Stat label="Total cost" value={money(c.total_cost)} hint={c.budget_used_percent != null ? `${c.budget_used_percent}% of budget` : "No budget set"} />
        <Stat label="Profit estimate" value={<span className={over ? "text-red-600" : "text-emerald-700"}>{money(c.profit_estimate)}</span>} hint={c.margin_percent != null ? `${c.margin_percent}% margin` : undefined} />
        <Stat label="Labour hours" value={c.labour_hours} hint={`${c.subcontractors} subcontractor${c.subcontractors === 1 ? "" : "s"} assigned`} />
      </div>
      <div className="mt-5">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${over ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {bars.map(([label, v, color]) => (
            <li key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>
              <span className="font-medium tabular-nums text-slate-900">{money(v)}</span>
            </li>
          ))}
        </ul>
        {Object.keys(c.expenses_by_category).length > 0 && (
          <p className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {Object.entries(c.expenses_by_category).map(([k, v]) => <span key={k} className="rounded bg-slate-100 px-2 py-1 capitalize">{k}: {money(v ?? 0)}</span>)}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function ExpensesPage() {
  const { me } = useSession();
  const manage = can(me, "expenses.manage");
  const { projects } = useLookups();
  const [filters, setFilters] = useState({ project_id: "", category: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const q = new URLSearchParams({ page: String(page) });
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  const { data, error, reload } = useFetch<ExpensePage>(`/app/expenses?${q}`);
  // Costing is optional (only when a job is selected); errors just hide the panel.
  const { data: costingData, error: costingError } = useFetch<Costing>(filters.project_id ? `/app/projects/${filters.project_id}/costing` : null);
  const costing = filters.project_id && !costingError && costingData?.project.id === Number(filters.project_id) ? costingData : null;

  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const setFilter = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters({ ...filters, [k]: v });
  };

  const open = (e: Expense | "new") => {
    setFormError(null);
    setEditing(e);
    setForm(
      e === "new"
        ? { ...blank(), project_id: filters.project_id }
        : {
            project_id: e.project_id ? String(e.project_id) : "", category: e.category, vendor: e.vendor ?? "", description: e.description ?? "",
            amount: toDollars(e.amount), expense_date: e.expense_date.slice(0, 10), receipt_url: e.receipt_url ?? "",
          },
    );
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = { ...form, project_id: idOrNull(form.project_id), amount: toCents(form.amount), receipt_url: form.receipt_url || null };
    try {
      if (editing === "new") await crm("/app/expenses", { body });
      else if (editing) await crm(`/app/expenses/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || editing === "new" || !confirm("Delete this expense?")) return;
    try {
      await crm(`/app/expenses/${editing.id}`, { method: "DELETE" });
      setEditing(null);
      reload();
    } catch (e) {
      setFormError(e);
    }
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader
        title="Job expenses"
        subtitle="Materials, equipment, permits and other costs per job."
        actions={manage && <Button onClick={() => open("new")}>Add expense</Button>}
      />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Job">
            <Select value={filters.project_id} onChange={(e) => setFilter("project_id", e.target.value)}>
              <option value="">All jobs</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </Select>
          </Field>
          <Field label="From"><Input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} /></Field>
        </div>
      </Card>

      {costing && <CostingPanel c={costing} />}

      <ErrorText error={error} />
      {data === null ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white">Total {money(data.total_amount)}</span>
            {Object.entries(data.by_category).map(([k, v]) => (
              <button key={k} onClick={() => setFilter("category", filters.category === k ? "" : k)} className={`rounded-lg px-3 py-1.5 capitalize ring-1 ${filters.category === k ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-700 ring-slate-200"}`}>
                {k}: {money(v ?? 0)}
              </button>
            ))}
          </div>
          <Card className="max-sm:[&_:is(th,td):nth-child(n+4):nth-child(-n+6)]:hidden">
            <Table
              rows={data.data}
              onRow={open}
              empty={Object.values(filters).some(Boolean) ? "No expenses match these filters." : (
                <EmptyState
                  icon="🧾"
                  title="No expenses yet"
                  hint="Record materials, equipment and other costs against jobs to see real job costing."
                  action={manage && <Button onClick={() => open("new")}>Add expense</Button>}
                />
              )}
              columns={[
                ["Date", (e) => <span className="whitespace-nowrap">{formatDate(e.expense_date.slice(0, 10))}</span>],
                ["Job", (e) => e.project?.name ?? <span className="text-slate-500">Overhead</span>],
                ["Category", (e) => <Badge tone={e.category === "materials" ? "blue" : e.category === "subcontractor" ? "amber" : "gray"}>{e.category}</Badge>],
                ["Vendor", (e) => e.vendor ?? "—"],
                ["Description", (e) => e.description ?? "—"],
                ["Receipt", (e) => (e.receipt_url ? <a href={e.receipt_url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="text-brand-700 underline">View</a> : "—")],
                ["Amount", (e) => <span className="font-medium tabular-nums text-slate-900">{money(e.amount)}</span>],
              ]}
            />
            {(data.last_page ?? 1) > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span>Page {data.current_page} of {data.last_page}</span>
                <Button variant="secondary" disabled={page >= (data.last_page ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={editing !== null} title={editing === "new" ? "Add expense" : "Expense"} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-3">
          <fieldset disabled={!manage} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Amount ($)" error={fieldError(formError, "amount")}><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} required /></Field>
              <Field label="Date" error={fieldError(formError, "expense_date")}><Input type="date" value={form.expense_date} onChange={set("expense_date")} required /></Field>
              <Field label="Category" error={fieldError(formError, "category")}>
                <Select value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
              </Field>
              <Field label="Job" error={fieldError(formError, "project_id")}>
                <Select value={form.project_id} onChange={set("project_id")}>
                  <option value="">Overhead (no job)</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Vendor"><Input value={form.vendor} onChange={set("vendor")} /></Field>
            <Field label="Description"><Input value={form.description} onChange={set("description")} /></Field>
            <Field label="Receipt URL" error={fieldError(formError, "receipt_url")}><Input type="url" value={form.receipt_url} onChange={set("receipt_url")} placeholder="https://…" /></Field>
          </fieldset>
          <ErrorText error={formError && !Object.keys((formError as { errors?: object }).errors ?? {}).length ? formError : null} />
          {manage && (
            <div className="flex justify-between pt-2">
              {editing !== "new" ? <Button type="button" variant="danger-ghost" onClick={remove}>Delete</Button> : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                <Button disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
