"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "@/lib/session";
import { can, hasModule } from "@/lib/api";
import { crmNav } from "@/lib/nav";
import { Shell } from "@/components/shell/Shell";
import { EmptyState, statusLabel } from "@/components/ui";

const BILLING = "/app/billing";

function CrmShell({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const path = usePathname();
  const router = useRouter();
  const inactive = me?.tenant?.accessible === false;
  const onBilling = path === BILLING || path.startsWith(BILLING + "/");
  const canBill = can(me, "account.manage");

  useEffect(() => {
    if (inactive && canBill && !onBilling) router.replace(BILLING);
  }, [inactive, canBill, onBilling, router]);

  const brand = (
    <div>
      <p className="text-lg font-bold text-brand-700">BuildCRM</p>
      <p className="truncate text-xs text-slate-500">{me?.tenant?.name}</p>
    </div>
  );

  if (inactive) {
    // Minimal shell: only the subscription page works until the BuildCRM team reactivates the account.
    const items = canBill ? [{ href: BILLING, label: "Subscription" }] : [];
    return (
      <Shell brand={brand} items={items}>
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-lg font-semibold text-red-800">Your subscription is inactive</p>
          <p className="mt-1 text-sm text-red-700">
            {me?.tenant?.status === "trial" ? "Your free trial has ended." : `Account status: ${statusLabel(me?.tenant?.status ?? "")}.`}{" "}
            {canBill
              ? "Choose a plan below to send a request. Your data is kept safe and everything unlocks as soon as the BuildCRM team activates your plan."
              : "Your data is safe. Ask your account owner to renew the subscription."}
          </p>
        </div>
        {canBill ? (onBilling ? children : null) : (
          <EmptyState icon="🔒" title="CRM access is paused" hint="Only account admins can renew the subscription." />
        )}
      </Shell>
    );
  }

  const items = crmNav.filter((i) => hasModule(me, i.module) && can(me, i.perm));
  return <Shell brand={brand} items={items}>{children}</Shell>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider realm="crm" loginPath="/login">
      <CrmShell>{children}</CrmShell>
    </SessionProvider>
  );
}
