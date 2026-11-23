"use client";

import { useState } from "react";
import { ApiError, can, crm, money } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Button, ErrorText, Field, Input, Link, Spinner, cx, fieldError } from "@/components/ui";
import type { Addon } from "../addons/_types";

type Company = { name: string; slug: string; email: string | null; phone: string | null };
const STEPS = ["Your company", "Add-ons", "Your website"];

export default function SetupPage() {
  const { me, refresh } = useSession();
  const [step, setStep] = useState(0);

  if (!me) return <Spinner />;
  if (!can(me, "account.manage")) {
    return (
      <Centered>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to {me.tenant?.name ?? "BuildCRM"}, {me.name.split(" ")[0]}!</h1>
        <p className="mt-2 text-slate-600">Your account is ready. Head to the dashboard to get started.</p>
        <Link href="/app" className="mt-6 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Go to dashboard</Link>
      </Centered>
    );
  }

  return (
    <Centered>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-brand-700">Setup · Step {step + 1} of {STEPS.length}</span>
        <Link href="/app" className="font-medium text-slate-500 hover:text-slate-900 hover:underline">Skip for now →</Link>
      </div>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">Welcome to BuildCRM, {me.name.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-sm text-slate-600">Three quick steps and your CRM and website are ready. You can change everything later.</p>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-4 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500" : "bg-slate-100 text-slate-500")}>
              {i < step ? "✓" : i + 1}
            </span>
            <span className={cx("hidden text-sm sm:inline", i === step ? "font-medium text-slate-900" : "text-slate-500")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-lg shadow-slate-200/60 sm:p-8">
        {step === 0 && <CompanyStep onDone={async () => { await refresh(); setStep(1); }} />}
        {step === 1 && <AddonStep onBack={() => setStep(0)} onDone={async () => { await refresh(); setStep(2); }} />}
        {step === 2 && <WebsiteStep slug={me.tenant?.slug ?? ""} onBack={() => setStep(1)} />}
      </div>
    </Centered>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="-mx-4 flex min-h-[calc(100vh-8rem)] items-start justify-center rounded-2xl bg-gradient-to-b from-brand-50/70 to-transparent px-4 py-8 sm:mx-0 sm:py-12">
    <div className="w-full max-w-2xl text-center">{children}</div>
  </div>
);

function CompanyStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data: form, setData: setForm, error: loadError } = useFetch<Company>("/app/account/company");
  const [saveError, setError] = useState<unknown>(null);
  const error = saveError ?? loadError;
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await crm("/app/account/company", { method: "PUT", body: { name: form.name, email: form.email || null, phone: form.phone || null } });
      await onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (!form) return error ? <ErrorText error={error} /> : <Spinner />;
  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Confirm your company details</h2>
        <p className="text-sm text-slate-500">These appear on your estimates, invoices and website.</p>
      </div>
      <ErrorText error={error instanceof ApiError && Object.keys(error.errors).length ? null : error} />
      <Field label="Company name" error={fieldError(error, "name")}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business email" error={fieldError(error, "email")}><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Business phone" error={fieldError(error, "phone")}><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Button disabled={busy}>{busy ? "Saving…" : "Looks good — continue"}</Button>
      </div>
    </form>
  );
}

function AddonStep({ onBack, onDone }: { onBack: () => void; onDone: () => Promise<void> }) {
  const { data, error: loadError } = useFetch<{ data: Addon[] }>("/app/addons");
  const addons = data?.data ?? null;
  const [picked, setPicked] = useState<string[]>([]);
  const [saveError, setError] = useState<unknown>(null);
  const error = saveError ?? loadError;
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) => setPicked((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const next = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const key of picked) await crm(`/app/addons/${key}/install`, { method: "POST" });
      await onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (!addons) return error ? <ErrorText error={error} /> : <Spinner />;
  const extra = addons.filter((a) => picked.includes(a.key) && !a.included_in_plan).reduce((s, a) => s + a.price_monthly, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pick the add-ons you want now</h2>
        <p className="text-sm text-slate-500">Your core CRM is ready. You can add or remove these any time from Add-ons.</p>
      </div>
      <ErrorText error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {addons.map((a) => {
          const on = a.installed || picked.includes(a.key);
          return (
            <button
              key={a.key}
              type="button"
              disabled={a.installed}
              onClick={() => toggle(a.key)}
              className={cx("rounded-lg border p-4 text-left transition", on ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300", a.installed && "cursor-default")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-slate-900">{a.name}</span>
                <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>{on && "✓"}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{a.description}</p>
              <p className="mt-2 text-xs font-medium text-slate-700">{a.installed ? "Already installed" : a.included_in_plan ? "Included in plan" : `${money(a.price_monthly)}/mo`}</p>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <div className="flex items-center gap-3">
          {extra > 0 && <span className="text-sm text-slate-500">+{money(extra)}/mo</span>}
          <Button onClick={next} disabled={busy}>{busy ? "Installing…" : picked.length ? `Install ${picked.length} & continue` : "Continue without add-ons"}</Button>
        </div>
      </div>
    </div>
  );
}

function WebsiteStep({ slug, onBack }: { slug: string; onBack: () => void }) {
  return (
    <div className="space-y-5 text-center">
      <div className="text-4xl">🏗️</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">You&apos;re all set!</h2>
        <p className="mt-1 text-sm text-slate-600">
          Your company website is live at <Link href={`/site/${slug}`} className="font-mono text-brand-700 hover:underline">/site/{slug}</Link>. It grows as you add services, projects and reviews.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/app/website" className="rounded-lg border border-brand-500 bg-brand-50 p-4 text-left hover:bg-brand-100">
          <p className="font-medium text-brand-800">Set up your website →</p>
          <p className="mt-1 text-xs text-brand-700">Add your services, photos and contact details.</p>
        </Link>
        <Link href="/app" className="rounded-lg border border-slate-200 p-4 text-left hover:border-slate-300">
          <p className="font-medium text-slate-900">Go to dashboard →</p>
          <p className="mt-1 text-xs text-slate-600">Start adding leads, customers and jobs.</p>
        </Link>
      </div>
      <div className="text-left"><Button variant="ghost" onClick={onBack}>← Back</Button></div>
    </div>
  );
}
