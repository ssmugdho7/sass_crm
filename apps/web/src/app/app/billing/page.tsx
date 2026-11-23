"use client";

import { useState } from "react";
import { ApiError, can, crm, formatDate, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, EmptyState, ErrorText, Modal, PageHeader, Spinner, Stat, cx, statusLabel } from "@/components/ui";

type Cycle = "monthly" | "yearly";
type Plan = { id: number; name: string; slug: string; price_monthly: number; price_yearly: number; max_users: number | null; included_modules: string[] | null; features: string[] | null; requires_approval: Record<Cycle, boolean> };
type Billing = {
  plan: Plan | null;
  status: string;
  accessible: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_cycle: Cycle;
  can_self_change: boolean;
  requested_plan: Pick<Plan, "id" | "name" | "slug" | "price_monthly" | "price_yearly"> | null;
  requested_cycle: Cycle | null;
  plan_requested_at: string | null;
  addons: { key: string; name: string; price_monthly: number }[];
  addon_monthly_cost: number;
  plans: Plan[];
  message?: string;
};

const statusTone: Record<string, string> = { trial: "amber", active: "green", past_due: "red", suspended: "red", cancelled: "gray" };
const priceOf = (p: Pick<Plan, "price_monthly" | "price_yearly">, cycle: Cycle) => `${money(cycle === "yearly" ? p.price_yearly : p.price_monthly)}/${cycle === "yearly" ? "year" : "month"}`;
const daysLeft = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0);

export default function BillingPage() {
  const { me } = useSession();
  if (me && !can(me, "account.manage")) {
    return (
      <div>
        <PageHeader title="Subscription" />
        <EmptyState icon="🔒" title="Only account admins can view billing" hint="Ask your account owner about your plan and invoices." />
      </div>
    );
  }
  return <BillingView />;
}

function BillingView() {
  const { refresh } = useSession();
  const { data, setData, error: loadError } = useFetch<Billing>("/app/billing");
  const [cycleChoice, setCycle] = useState<Cycle | null>(null);
  const cycle = cycleChoice ?? (data?.billing_cycle === "yearly" ? "yearly" : "monthly");
  const [actionError, setError] = useState<unknown>(null);
  const error = actionError ?? loadError;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Plan | null>(null);

  const submit = async () => {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await crm<Billing>("/app/billing/change-plan", { body: { plan: confirming.slug, cycle } });
      setData(next);
      setNotice(next.message ?? null);
      setConfirming(null);
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <ErrorText error={error} /> : <Spinner />;
  const trialDays = daysLeft(data.trial_ends_at);
  const planCost = data.plan ? (data.billing_cycle === "yearly" ? Math.round(data.plan.price_yearly / 12) : data.plan.price_monthly) : 0;
  const selfChange = confirming ? !confirming.requires_approval[cycle] : false;
  const planError = actionError instanceof ApiError ? actionError.errors.plan?.[0] : undefined;

  return (
    <div>
      <PageHeader title="Subscription" subtitle="Your plan, trial and add-on charges." />
      {!confirming && <ErrorText error={error} />}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notice}</p>}

      {data.requested_plan && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div>
            <p className="font-semibold text-blue-900">
              Requested: {data.requested_plan.name} ({data.requested_cycle}) — awaiting confirmation
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Sent {formatDate(data.plan_requested_at)}. The BuildCRM team will send an invoice for {priceOf(data.requested_plan, data.requested_cycle ?? "monthly")} and activate the plan once it&apos;s paid. Your current access is unchanged until then.
            </p>
          </div>
          <Badge tone="blue">Pending</Badge>
        </div>
      )}

      {data.status === "trial" && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-lg font-semibold text-brand-800">{trialDays > 0 ? `${trialDays} day${trialDays === 1 ? "" : "s"} left in your free trial` : "Your free trial has ended"}</p>
          <p className="mt-1 text-sm text-brand-700">Trial ends {formatDate(data.trial_ends_at)}. Request a plan below and we&apos;ll activate it once your first invoice is paid.</p>
        </div>
      )}
      {data.status === "suspended" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-lg font-semibold text-red-800">Your account is suspended</p>
          <p className="mt-1 text-sm text-red-700">
            {data.requested_plan
              ? "Your plan request is with the BuildCRM team. Full access returns as soon as they activate it."
              : "Your trial or paid period has ended. Request a plan below; the BuildCRM team will invoice you and reactivate your account once it's paid. Your data is kept."}
          </p>
        </div>
      )}
      {data.status === "past_due" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-lg font-semibold text-red-800">Your payment is overdue</p>
          <p className="mt-1 text-sm text-red-700">Settle your outstanding invoice with the BuildCRM team. Plan changes can be requested now and take effect after payment.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Current plan" value={<span className="flex items-center gap-2">{data.plan?.name ?? "None"} <Badge tone={statusTone[data.status] ?? "gray"}>{statusLabel(data.status)}</Badge></span>} hint={`Billed ${data.billing_cycle}`} />
        <Stat label="Estimated monthly total" value={money(planCost + data.addon_monthly_cost)} hint={`${money(planCost)} plan + ${money(data.addon_monthly_cost)} add-ons`} />
        <Stat label={data.status === "trial" ? "Trial ends" : data.status === "active" ? "Renews on" : "Subscription access"} value={data.status === "trial" ? formatDate(data.trial_ends_at) : data.status === "active" ? formatDate(data.current_period_end) : "Paused"} hint={data.status === "active" || data.status === "trial" ? undefined : "Reactivates after payment is confirmed"} />
      </div>

      {data.addons.length > 0 && (
        <Card title="Paid add-ons" className="mt-6">
          <ul className="divide-y divide-slate-100 text-sm">
            {data.addons.map((a) => (
              <li key={a.key} className="flex justify-between py-2"><span>{a.name}</span><span className="font-medium">{money(a.price_monthly)}/mo</span></li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-8 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {data.can_self_change
          ? "Eligible downgrades apply immediately. Upgrades and billing-cycle changes require confirmation from the BuildCRM team before access changes."
          : "No card is charged in the app. Choosing a plan sends a request to the BuildCRM team, who will invoice you and activate it once paid."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium" role="group" aria-label="Billing cycle">
          {(["monthly", "yearly"] as const).map((c) => (
            <button key={c} aria-pressed={cycle === c} onClick={() => setCycle(c)} className={cx("rounded-md px-4 py-1.5 capitalize", cycle === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}>{c}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {data.plans.map((p) => {
          const isPlan = data.plan?.slug === p.slug;
          const current = isPlan && data.billing_cycle === cycle && data.status === "active";
          const requested = data.requested_plan?.slug === p.slug && data.requested_cycle === cycle;
          const label = current ? "Current plan" : requested ? "Requested" : !p.requires_approval[cycle] ? `Switch to ${isPlan ? cycle : p.name}` : `Request ${p.name}`;
          return (
            <div key={p.slug} className={cx("flex flex-col rounded-xl border bg-white p-5 shadow-sm", isPlan ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                {isPlan && <Badge tone="blue">Your plan</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {money(cycle === "yearly" ? p.price_yearly : p.price_monthly)}
                <span className="text-sm font-normal text-slate-500">/{cycle === "yearly" ? "yr" : "mo"}</span>
              </p>
              {p.max_users !== null && <p className="mt-1 text-sm text-slate-600">Up to {p.max_users} users</p>}
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
                {(p.features ?? []).map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <Button className="mt-5" variant={isPlan ? "primary" : "secondary"} disabled={current || requested || busy} onClick={() => { setError(null); setConfirming(p); }}>
                {label}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">Add-ons included in your plan are installed automatically. Switching to a smaller plan turns off add-ons that only the old plan included; add-ons you bought separately stay on.</p>

      <Modal open={confirming !== null} title={confirming ? `${selfChange ? "Switch to" : "Request"} ${confirming.name} (${cycle})` : ""} onClose={() => !busy && setConfirming(null)}>
        {confirming && (
          <div className="space-y-4 text-sm text-slate-700">
            <p className="text-2xl font-bold text-slate-900">{priceOf(confirming, cycle)}</p>
            <div>
              <p className="font-medium text-slate-900">What happens next</p>
              {selfChange ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Your plan changes to {confirming.name} right away.</li>
                  <li>Your renewal date ({formatDate(data.current_period_end)}) stays the same; the new price appears on your next invoice.</li>
                  <li>Add-ons that only your current plan included will be turned off.</li>
                </ul>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>We send your request to the BuildCRM team. Nothing is charged here.</li>
                  <li>They&apos;ll invoice you for {priceOf(confirming, cycle)} and activate the plan once it&apos;s paid.</li>
                  <li>Until then your current plan and access stay as they are.</li>
                </ul>
              )}
            </div>
            <ErrorText error={planError ?? actionError} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>Cancel</Button>
              <Button type="button" disabled={busy} onClick={submit}>{busy ? "Sending…" : selfChange ? "Confirm change" : "Send request"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
