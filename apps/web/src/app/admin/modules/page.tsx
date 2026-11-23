"use client";

import { useState } from "react";
import { money, platform } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, PageHeader, Spinner, Table } from "@/components/ui";
import { toCents, toDollars, useLoad } from "../_shared";

type Mod = { key: string; name: string; category: string; description: string | null; is_core: boolean; is_active: boolean; price_monthly: number; installed_count: number };

export default function ModulesPage() {
  const { data, error, reload } = useLoad<Mod[]>("/platform/modules");
  const [actionError, setActionError] = useState<unknown>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  async function save(m: Mod, body: Partial<Pick<Mod, "is_active" | "price_monthly">>) {
    setActionError(null);
    try {
      await platform(`/platform/modules/${m.key}`, { method: "PUT", body });
      setPrices((p) => { const next = { ...p }; delete next[m.key]; return next; });
      await reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <>
      <PageHeader title="Modules" subtitle="The module catalog. Core modules are always on; add-ons are installed per account." />
      <ErrorText error={error ?? actionError} />
      <Card>
        {!data ? <Spinner /> : (
          <Table
            rows={data}
            columns={[
              ["Module", (m) => <div><p className="font-medium text-slate-900">{m.name}</p><p className="max-w-md text-xs text-slate-500">{m.description}</p></div>],
              ["Category", (m) => <Badge tone={m.is_core ? "blue" : "gray"}>{m.is_core ? "core" : m.category}</Badge>],
              ["Installed", (m) => (m.is_core ? "all" : m.installed_count)],
              ["Price / mo", (m) => m.is_core ? money(0) : (
                <div className="flex items-center gap-2">
                  <Input className="w-24 py-1" type="number" min="0" step="0.01" value={prices[m.key] ?? toDollars(m.price_monthly)}
                    onChange={(e) => setPrices({ ...prices, [m.key]: e.target.value })} />
                  {prices[m.key] !== undefined && <Button className="px-3 py-1" onClick={() => save(m, { price_monthly: toCents(prices[m.key]) })}>Save</Button>}
                </div>
              )],
              ["Status", (m) => m.is_core ? <Badge tone="green">always on</Badge> : (
                <Button variant={m.is_active ? "secondary" : "primary"} className="px-3 py-1" onClick={() => save(m, { is_active: !m.is_active })}>
                  {m.is_active ? "Active — disable" : "Inactive — enable"}
                </Button>
              )],
            ]}
          />
        )}
      </Card>
    </>
  );
}
