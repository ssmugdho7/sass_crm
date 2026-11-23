"use client";

import { useEffect, useState } from "react";
import { crm, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, PageHeader, Spinner, Stat, cx } from "@/components/ui";

type Plan = { id: number; name: string; slug: string; price_monthly: number; price_yearly: number; max_users: number; included_modules: string[] | null; features: string[] | null };
type Billing = {
  plan: Plan | null;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_cycle: "monthly" | "yearly";
  addons: { key: string; name: string; price_monthly: number }[];
  addon_monthly_cost: number;
  plans: Plan[];
};

const statusTone: Record<string, string> = { trial: "amber", active: "green", past_due: "red", suspended: "red", cancelled: "gray" };
const daysLeft = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0);
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

export default function BillingPage() {
  const { refresh } = useSession();
  const [data, setData] = useState<Billing | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    crm<Billing>("/app/billing")
      .then((b) => {
        setData(b);
        setCycle(b.billing_cycle === "yearly" ? "yearly" : "monthly");
      })
      .catch(setError);
  }, []);

  const change = async (p: Plan) => {
    if (!confirm(`Switch to ${p.name} (${cycle}) for ${money(cycle === "yearly" ? p.price_yearly : p.price_monthly)}/${cycle === "yearly" ? "yr" : "mo"}?`)) return;
    setBusy(p.slug);
    setError(null);
    setNotice(null);
    try {
      setData(await crm<Billing>("/app/billing/change-plan", { body: { plan: p.slug, cycle } }));
      setNotice(`You're now on the ${p.name} plan.`);
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  if (!data) return error ? <ErrorText error={error} /> : <Spinner />;
  const trialDays = daysLeft(data.trial_ends_at);
  const planCost = data.plan ? (data.billing_cycle === "yearly" ? Math.round(data.plan.price_yearly / 12) : data.plan.price_monthly) : 0;

  return (
    <div>
      <PageHeader title="Subscription" subtitle="Your plan, trial and add-on charges." />
      <ErrorText error={error} />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {data.status === "trial" && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-lg font-semibold text-brand-800">{trialDays > 0 ? `${trialDays} day${trialDays === 1 ? "" : "s"} left in your free trial` : "Your free trial has ended"}</p>
          <p className="mt-1 text-sm text-brand-700">Trial ends {date(data.trial_ends_at)}. Choose a plan below to keep everything running.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Current plan" value={<span className="flex items-center gap-2">{data.plan?.name ?? "None"} <Badge tone={statusTone[data.status] ?? "gray"}>{data.status.replace("_", " ")}</Badge></span>} hint={`Billed ${data.billing_cycle}`} />
        <Stat label="Estimated monthly total" value={money(planCost + data.addon_monthly_cost)} hint={`${money(planCost)} plan + ${money(data.addon_monthly_cost)} add-ons`} />
        <Stat label={data.status === "trial" ? "Trial ends" : "Renews on"} value={date(data.status === "trial" ? data.trial_ends_at : data.current_period_end)} />
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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {(["monthly", "yearly"] as const).map((c) => (
            <button key={c} onClick={() => setCycle(c)} className={cx("rounded-md px-4 py-1.5 capitalize", cycle === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}>{c}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {data.plans.map((p) => {
          const current = data.plan?.slug === p.slug && data.billing_cycle === cycle && data.status === "active";
          const isPlan = data.plan?.slug === p.slug;
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
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
                {(p.features ?? []).map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <Button className="mt-5" variant={isPlan ? "secondary" : "primary"} disabled={current || busy !== null} onClick={() => change(p)}>
                {busy === p.slug ? "Switching…" : current ? "Current plan" : isPlan ? (data.status === "trial" ? "Activate plan" : `Switch to ${cycle}`) : `Choose ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-400">Plan changes take effect immediately. Add-ons included in your plan are installed automatically.</p>
    </div>
  );
}
