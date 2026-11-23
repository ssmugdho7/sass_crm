import Link from "next/link";

export default function SiteNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">404</p>
      <h1 className="text-3xl font-bold text-slate-900">This website isn&apos;t available</h1>
      <p className="max-w-md text-slate-600">The company site you&apos;re looking for doesn&apos;t exist or isn&apos;t published yet.</p>
      <Link href="/" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900">Go to BuildCRM</Link>
    </main>
  );
}
