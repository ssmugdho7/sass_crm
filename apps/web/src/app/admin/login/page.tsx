"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, tokens } from "@/lib/api";
import { Button, ErrorText, Field, Input, fieldError } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokens.get("platform")) router.replace("/admin");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/auth/platform/login", { body: form });
      tokens.set("platform", res.token);
      router.push("/admin");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-lg font-bold text-slate-900">BuildCRM <span className="text-brand-600">Admin</span></p>
          <p className="mt-1 text-sm text-slate-500">Platform operators only.</p>
        </div>
        <ErrorText error={error} />
        <Field label="Email" error={fieldError(error, "email")}>
          <Input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" error={fieldError(error, "password")}>
          <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
