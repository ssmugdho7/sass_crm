"use client";

import { useState } from "react";
import { can, crm, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, EmptyState, ErrorText, Link, PageHeader, Spinner } from "@/components/ui";
import type { Addon } from "./_types";

const categoryIcon: Record<string, string> = { core: "🧱", finance: "💰", operations: "🛠️", payments: "💳", productivity: "📅" };

export default function AddonsPage() {
  const { me } = useSession();
  if (me && !can(me, "account.manage")) {
    return (
      <div>
        <PageHeader title="Add-ons" />
        <EmptyState icon="🔒" title="Only account admins can manage add-ons" hint="Ask your account owner to install or configure add-ons." />
      </div>
    );
  }
  return <AddonsList />;
}

function AddonsList() {
  const { me, refresh } = useSession();
  const canPayments = can(me, "payments.manage");
  const { data, setData, error: loadError } = useFetch<{ data: Addon[] }>("/app/addons");
  const addons = data?.data ?? null;
  const [actionError, setError] = useState<unknown>(null);
  const error = actionError ?? loadError;
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (a: Addon) => {
    if (a.installed && !confirm(`Uninstall ${a.name}? Your settings are kept if you reinstall later.`)) return;
    setBusy(a.key);
    setError(null);
    try {
      const next = await crm<Addon>(a.installed ? `/app/addons/${a.key}` : `/app/addons/${a.key}/install`, { method: a.installed ? "DELETE" : "POST" });
      setData((cur) => (cur ? { data: cur.data.map((x) => (x.key === a.key ? next : x)) } : cur));
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Add-ons" subtitle="Extend BuildCRM with the tools your business needs. Request paid add-ons for approval, or manage installed tools." />
      <ErrorText error={error} />
      {!addons ? (
        error ? null : <Spinner />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {addons.map((a) => (
            <article key={a.key} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl">{categoryIcon[a.category] ?? "🧩"}</span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{a.category}</p>
                    <h2 className="mt-0.5 font-semibold text-slate-900">{a.name}</h2>
                  </div>
                </div>
                {a.installed && <Badge tone="green">Installed</Badge>}
                {a.pending && <Badge tone="amber">Awaiting approval</Badge>}
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-600">{a.description}</p>
              {!a.included_in_plan && (
                <p className="mt-4 text-sm font-semibold text-slate-900">{money(a.price_monthly)}<span className="font-normal text-slate-500">/mo</span></p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                {a.included_in_plan && <span className="text-sm font-medium text-emerald-700">Included in your plan</span>}
                {a.included_in_plan && a.installed && a.configurable && (a.key !== "payment_gateway" || canPayments) && <span aria-hidden className="text-sm text-slate-500">·</span>}
                {a.installed && a.included_in_plan ? null : a.key === "payment_gateway" && !canPayments ? (
                  <span className="text-sm text-slate-500">Needs the payments permission</span>
                ) : (
                  <Button variant={a.installed ? "secondary" : "primary"} disabled={busy === a.key || a.pending} onClick={() => toggle(a)}>
                    {busy === a.key ? "Working…" : a.installed ? "Uninstall" : a.pending ? "Requested" : a.price_monthly > 0 && !a.included_in_plan ? "Request add-on" : "Install"}
                  </Button>
                )}
                {a.installed && a.configurable && (a.key !== "payment_gateway" || canPayments) && (
                  <Link href={`/app/addons/${a.key}`} className="text-sm font-medium text-brand-700 hover:underline">Configure →</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
