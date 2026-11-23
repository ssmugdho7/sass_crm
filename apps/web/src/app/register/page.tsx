"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, ApiError, money, tokens } from "@/lib/api";
import { Button, ErrorText, Field, Input, Select, Spinner, fieldError } from "@/components/ui";
import { AuthShell } from "@/components/marketing/AuthShell";
import { Check } from "@/components/marketing/Pricing";
import { useCatalog } from "@/components/marketing/plans";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Start your 14-day free trial"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
      aside={<Aside />}
    >
      {/* useSearchParams must sit under a Suspense boundary for static prerendering. */}
      <Suspense fallback={<Spinner />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { catalog, error: catalogError } = useCatalog();
  const [form, setForm] = useState({ company: "", name: "", email: "", phone: "", password: "", plan: params.get("plan") ?? "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // Once plans load, fall back to the first plan if the ?plan= value is missing or unknown.
  const plans = catalog?.plans;
  const plan = plans?.some((p) => p.slug === form.plan) ? form.plan : (plans?.[0]?.slug ?? form.plan);

  useEffect(() => {
    if (tokens.get("crm")) router.replace("/app");
  }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/auth/register", {
        body: { ...form, phone: form.phone || null, plan: plan || null },
      });
      tokens.set("crm", res.token);
      router.push("/app/setup");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const banner = error instanceof ApiError && Object.keys(error.errors).length ? null : error;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <ErrorText error={banner} />
      <Field label="Company name" error={fieldError(error, "company")}>
        <Input autoComplete="organization" required autoFocus value={form.company} onChange={set("company")} placeholder="e.g. Summit Roofing Co." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={fieldError(error, "name")}>
          <Input autoComplete="name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Phone (optional)" error={fieldError(error, "phone")}>
          <Input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </Field>
      </div>
      <Field label="Work email" error={fieldError(error, "email")}>
        <Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Password" error={fieldError(error, "password")}>
        <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} placeholder="At least 8 characters" />
      </Field>
      <Field label="Plan" error={fieldError(error, "plan") ?? (catalogError ? "Plans could not be loaded — you can choose one later." : undefined)}>
        <Select value={plan} onChange={set("plan")} disabled={!plans}>
          {!plans && <option value="">{catalogError ? "Default plan" : "Loading plans…"}</option>}
          {plans?.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} — {money(p.price_monthly)}/mo · up to {p.max_users} users
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={busy} className="w-full py-2.5">
        {busy ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-slate-500">Free for 14 days. No credit card required.</p>
    </form>
  );
}

function Aside() {
  return (
    <>
      <p className="text-3xl font-bold leading-tight">Your construction business, organised in minutes.</p>
      <ul className="mt-8 space-y-4 text-slate-200">
        {["Leads, estimates, jobs & invoices in one place", "Tasks for your field crew", "Your own company website, included", "Add online payments, timesheets & more anytime"].map((t) => (
          <li key={t} className="flex gap-3">
            <Check /> {t}
          </li>
        ))}
      </ul>
    </>
  );
}
