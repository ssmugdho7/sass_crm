"use client";

import { useEffect, useState } from "react";
import { crm, money } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, ErrorText, Link, PageHeader, Spinner } from "@/components/ui";
import type { Addon } from "./_types";

export default function AddonsPage() {
  const { refresh } = useSession();
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    crm<{ data: Addon[] }>("/app/addons").then((r) => setAddons(r.data)).catch(setError);
  }, []);

  const toggle = async (a: Addon) => {
    if (a.installed && !confirm(`Uninstall ${a.name}? Your settings are kept if you reinstall later.`)) return;
    setBusy(a.key);
    setError(null);
    try {
      const next = await crm<Addon>(a.installed ? `/app/addons/${a.key}` : `/app/addons/${a.key}/install`, { method: a.installed ? "DELETE" : "POST" });
      setAddons((cur) => cur?.map((x) => (x.key === a.key ? next : x)) ?? null);
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Add-ons" subtitle="Extend BuildCRM with the tools your business needs. Install or remove them any time." />
      <ErrorText error={error} />
      {!addons ? (
        error ? null : <Spinner />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {addons.map((a) => (
            <article key={a.key} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{a.category}</p>
                  <h2 className="mt-0.5 font-semibold text-slate-900">{a.name}</h2>
                </div>
                {a.installed && <Badge tone="green">Installed</Badge>}
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-600">{a.description}</p>
              <p className="mt-4 text-sm font-semibold text-slate-900">
                {a.included_in_plan ? <span className="text-emerald-700">Included in plan</span> : <>{money(a.price_monthly)}<span className="font-normal text-slate-500">/mo</span></>}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button variant={a.installed ? "secondary" : "primary"} disabled={busy === a.key} onClick={() => toggle(a)}>
                  {busy === a.key ? "Working…" : a.installed ? "Uninstall" : "Install"}
                </Button>
                {a.configurable && (
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
