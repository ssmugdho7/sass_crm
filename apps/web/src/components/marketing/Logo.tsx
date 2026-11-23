import Link from "next/link";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight" aria-label="BuildCRM home">
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
        </svg>
      </span>
      <span className={dark ? "text-white" : "text-slate-900"}>
        Build<span className="text-brand-600">CRM</span>
      </span>
    </Link>
  );
}
