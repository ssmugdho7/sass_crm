"use client";

import { SessionProvider, useSession } from "@/lib/session";
import { can, hasModule } from "@/lib/api";
import { crmNav } from "@/lib/nav";
import { Shell } from "@/components/shell/Shell";

function CrmShell({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const items = crmNav.filter((i) => hasModule(me, i.module) && can(me, i.perm));
  const brand = (
    <div>
      <p className="text-lg font-bold text-brand-700">BuildCRM</p>
      <p className="truncate text-xs text-slate-500">{me?.tenant?.name}</p>
    </div>
  );
  return <Shell brand={brand} items={items}>{children}</Shell>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider realm="crm" loginPath="/login">
      <CrmShell>{children}</CrmShell>
    </SessionProvider>
  );
}
