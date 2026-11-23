"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "@/lib/session";
import { adminNav } from "@/lib/nav";
import { Shell } from "@/components/shell/Shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  if (usePathname() === "/admin/login") return children;
  return (
    <SessionProvider realm="platform" loginPath="/admin/login">
      <Shell brand={<p className="text-lg font-bold text-slate-900">BuildCRM <span className="text-brand-600">Admin</span></p>} items={adminNav}>
        {children}
      </Shell>
    </SessionProvider>
  );
}
