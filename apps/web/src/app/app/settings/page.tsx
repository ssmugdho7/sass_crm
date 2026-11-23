"use client";

import { useEffect, useState } from "react";
import { ApiError, can, crm } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Card, ErrorText, Field, Input, PageHeader, fieldError } from "@/components/ui";

type Company = { id: number; name: string; slug: string; email: string | null; phone: string | null };
const generalError = (e: unknown) => (e instanceof ApiError && Object.keys(e.errors).length ? null : e);

export default function SettingsPage() {
  const { me } = useSession();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Your company details and personal profile." />
      <CompanyCard editable={can(me, "team.manage")} />
      {me && <ProfileCard key={me.id} />}
    </div>
  );
}

function CompanyCard({ editable }: { editable: boolean }) {
  const { refresh } = useSession();
  const [form, setForm] = useState<Company | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    crm<Company>("/app/account/company").then(setForm).catch(setError);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setForm(await crm<Company>("/app/account/company", { method: "PUT", body: { name: form.name, email: form.email || null, phone: form.phone || null } }));
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Company profile">
      {!form ? (
        <ErrorText error={error} />
      ) : (
        <form onSubmit={save} className="space-y-4">
          <ErrorText error={generalError(error)} />
          {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Company details saved.</p>}
          <Field label="Company name" error={fieldError(error, "name")}><Input required disabled={!editable} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" error={fieldError(error, "email")}><Input type="email" disabled={!editable} value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone" error={fieldError(error, "phone")}><Input disabled={!editable} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Website address"><Input disabled value={`/site/${form.slug}`} className="font-mono text-xs" /></Field>
          {editable ? (
            <div className="flex justify-end"><Button disabled={busy}>{busy ? "Saving…" : "Save company"}</Button></div>
          ) : (
            <p className="text-xs text-slate-500">Only account managers can change company details.</p>
          )}
        </form>
      )}
    </Card>
  );
}

function ProfileCard() {
  const { me, refresh } = useSession();
  const [form, setForm] = useState({ name: me?.name ?? "", phone: me?.phone ?? "", current_password: "", password: "", password_confirmation: "" });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string | null> = { name: form.name, phone: form.phone || null };
      if (form.password) Object.assign(body, { password: form.password, password_confirmation: form.password_confirmation, current_password: form.current_password });
      await crm("/app/account/profile", { method: "PUT", body });
      setForm({ ...form, current_password: "", password: "", password_confirmation: "" });
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="My profile">
      <form onSubmit={save} className="space-y-4">
        <ErrorText error={generalError(error)} />
        {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Profile updated.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={fieldError(error, "name")}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone" error={fieldError(error, "phone")}><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="Email"><Input disabled value={me?.email ?? ""} /></Field>
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-sm font-medium text-slate-800">Change password <span className="font-normal text-slate-500">(optional)</span></p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password" error={fieldError(error, "current_password")}><Input type="password" autoComplete="current-password" required={!!form.password} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} /></Field>
            <Field label="New password" error={fieldError(error, "password")}><Input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Confirm new" error={fieldError(error, "password_confirmation")}><Input type="password" autoComplete="new-password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} /></Field>
          </div>
        </div>
        <div className="flex justify-end"><Button disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button></div>
      </form>
    </Card>
  );
}
