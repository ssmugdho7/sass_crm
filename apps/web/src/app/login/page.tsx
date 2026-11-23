"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, tokens } from "@/lib/api";
import { Button, ErrorText, Field, Input, fieldError } from "@/components/ui";
import { AuthShell } from "@/components/marketing/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokens.get("crm")) router.replace("/app");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/auth/login", { body: form });
      tokens.set("crm", res.token);
      router.push("/app");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  // Field-level messages render under inputs; only show the banner for other failures.
  const banner = error instanceof ApiError && Object.keys(error.errors).length ? null : error;

  return (
    <AuthShell
      title="Sign in to your CRM"
      subtitle={
        <>
          New to BuildCRM?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Start a 14-day free trial
          </Link>
        </>
      }
      aside={<Aside />}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <ErrorText error={banner} />
        <Field label="Email" error={fieldError(error, "email")}>
          <Input type="email" autoComplete="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" error={fieldError(error, "password")}>
          <Input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full py-2.5">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-10 text-center text-xs text-slate-500">
        Platform admin?{" "}
        <Link href="/admin/login" className="font-medium text-slate-700 hover:text-slate-900">
          Sign in here →
        </Link>
      </p>
    </AuthShell>
  );
}

function Aside() {
  return (
    <>
      <p className="text-3xl font-bold leading-tight">Every lead, job and invoice — right where you left it.</p>
      <p className="mt-4 text-slate-300">Pick up your pipeline, check today’s crew tasks and see who still owes you money.</p>
    </>
  );
}
