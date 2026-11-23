"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { Spinner, cx } from "@/components/ui";

export function Shell({ brand, items, children }: { brand: React.ReactNode; items: { href: string; label: string }[]; children: React.ReactNode }) {
  const { me, loading, logout } = useSession();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (loading || !me) return <Spinner />;
  const active = (href: string) => path === href || (href.split("/").length > 2 && path.startsWith(href + "/"));

  return (
    <div className="flex min-h-screen">
      <aside className={cx("fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-200 bg-white md:flex", open ? "flex" : "hidden")}>
        <div className="border-b border-slate-100 px-5 py-4">{brand}</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
              className={cx("block rounded-lg px-3 py-2 text-sm font-medium", active(i.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4 text-sm">
          <p className="font-medium text-slate-900">{me.name}</p>
          <p className="truncate text-slate-500">{me.email}</p>
          <button onClick={logout} className="mt-2 text-brand-700 hover:underline">Sign out</button>
        </div>
      </aside>
      <div className="flex-1 md:pl-64">
        <header className="sticky top-0 z-30 flex items-center border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="mr-3 text-xl">☰</button>
          {brand}
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
