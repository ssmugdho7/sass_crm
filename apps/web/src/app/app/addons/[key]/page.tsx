"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ApiError, can, crm } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useFetch } from "@/lib/useFetch";
import { Badge, Button, Card, ErrorText, Field, Input, Link, PageHeader, Select, Spinner, fieldError } from "@/components/ui";
import { type Addon, type AddonField, fieldHelp, fieldLabel } from "../_types";

export default function AddonConfigPage() {
  const { key } = useParams<{ key: string }>();
  const { me, refresh } = useSession();
  const [addon, setAddon] = useState<Addon | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = (a: Addon) => {
    setAddon(a);
    setValues(Object.fromEntries(a.fields.map((f) => {
      const v = "value" in f ? f.value ?? "" : "";
      // Selects (e.g. currency) need a value matching an option; default to the first one.
      const options = fieldHelp(a.key, f.key).options;
      return [f.key, options ? options.find((o) => o.toLowerCase() === v.toLowerCase()) ?? options[0] : v];
    })));
  };

  useEffect(() => {
    crm<Addon>(`/app/addons/${key}`).then(apply).catch(setError);
  }, [key]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      apply(await crm<Addon>(`/app/addons/${key}/config`, { method: "PUT", body: values }));
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    setBusy(true);
    try {
      apply(await crm<Addon>(`/app/addons/${key}/install`, { method: "POST" }));
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!addon) return error ? <div><BackLink /><ErrorText error={error} /></div> : <Spinner />;
  // Payment secrets decide where customer payments go, so they need payments.manage as well.
  const locked = key === "payment_gateway" && !can(me, "payments.manage");

  return (
    <div className="max-w-2xl">
      <BackLink />
      <PageHeader
        title={addon.name}
        subtitle={addon.description}
        actions={
          <>
            {addon.installed ? <Badge tone="green">Installed</Badge> : <Badge>Not installed</Badge>}
            {key === "payment_gateway" && !locked && (stripeReady(addon) ? <Badge tone="green">Ready to accept payments</Badge> : <Badge tone="amber">Not configured</Badge>)}
          </>
        }
      />
      {!addon.installed && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>This add-on isn&apos;t installed yet. You can save settings now and install it when ready.</span>
          <Button onClick={install} disabled={busy}>Install</Button>
        </div>
      )}

      {key === "payment_gateway" && !locked && addon.installed && <StripeWebhook />}
      {key === "google_calendar" && addon.installed && (
        <Suspense fallback={null}>
          <GoogleConnect />
        </Suspense>
      )}

      <Card title="Settings">
        {locked ? (
          <p className="text-sm text-slate-600">You need the <strong>Payments: Manage</strong> permission to view or change payment settings. Ask your account owner.</p>
        ) : (
        <form onSubmit={save} className="space-y-4">
          <ErrorText error={error instanceof ApiError && Object.keys(error.errors).length ? null : error} />
          {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Settings saved.</p>}
          {addon.fields.map((f) => (
            <SettingField key={f.key} addonKey={addon.key} field={f} value={values[f.key] ?? ""} error={fieldError(error, f.key)}
              onChange={(v) => setValues({ ...values, [f.key]: v })} />
          ))}
          <div className="flex justify-end">
            <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
          </div>
        </form>
        )}
      </Card>
    </div>
  );
}

/** Stripe can take payments once both server-side secrets are saved. */
const stripeReady = (a: Addon) => ["secret_key", "webhook_secret"].every((k) => a.fields.some((f) => f.key === k && "set" in f && f.set));

function SettingField({ addonKey, field, value, error, onChange }: { addonKey: string; field: AddonField; value: string; error?: string; onChange: (v: string) => void }) {
  const { help, placeholder, options } = fieldHelp(addonKey, field.key);
  const id = `setting-${field.key}`;
  const secret = field.type === "secret" && "set" in field;
  const status = secret ? (field.set ? `Saved (${field.hint ?? "••••"}). Leave blank to keep it.` : "Not set yet.") : null;
  const describedBy = [help && `${id}-help`, status && `${id}-status`].filter(Boolean).join(" ") || undefined;
  return (
    <Field label={fieldLabel(field.key)} error={error}>
      {options ? (
        <Select id={id} value={value} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : (
        <Input id={id} type={secret ? "password" : "text"} autoComplete={secret ? "new-password" : "off"} spellCheck={false}
          value={value} placeholder={placeholder} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />
      )}
      {help && <span id={`${id}-help`} className="block text-xs text-slate-500">{help}</span>}
      {status && <span id={`${id}-status`} className={`block text-xs ${secret && field.set ? "text-emerald-700" : "text-amber-700"}`}>{status}</span>}
    </Field>
  );
}

const BackLink = () => <Link href="/app/addons" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">← All add-ons</Link>;

function StripeWebhook() {
  const [copied, setCopied] = useState(false);
  const { data, error } = useFetch<{ url: string }>("/app/integrations/stripe/webhook-url");
  const url = data?.url ?? "";
  return (
    <Card title="Stripe webhook" className="mb-4">
      <p className="text-sm text-slate-600">In your Stripe dashboard, add a webhook endpoint with this URL (event <code>checkout.session.completed</code>), then paste its signing secret into <em>Webhook Secret</em> below. Keep this URL private.</p>
      <ErrorText error={error} />
      <div className="mt-3 flex gap-2">
        <Input readOnly value={url || "Loading…"} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        <Button type="button" variant="secondary" disabled={!url} onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</Button>
      </div>
    </Card>
  );
}

function GoogleConnect() {
  const params = useSearchParams();
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    crm<{ connected: boolean; email?: string }>("/app/integrations/google/status")
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await crm<{ url: string }>("/app/integrations/google/connect");
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google sign-in. Check the Client ID and secret below.");
      setBusy(false);
    }
  };

  return (
    <Card title="Google account" className="mb-4">
      {params?.get("connected") === "1" && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Google Calendar connected.</p>}
      {params?.get("error") && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Google didn&apos;t finish connecting. Please try again.</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {status === null ? "Checking connection…" : status.connected ? <>Connected{status.email && <> as <strong>{status.email}</strong></>}.</> : "Not connected. Save your OAuth Client ID and secret, then connect."}
        </p>
        <Button type="button" variant={status?.connected ? "secondary" : "primary"} onClick={connect} disabled={busy}>
          {busy ? "Redirecting…" : status?.connected ? "Reconnect Google account" : "Connect Google account"}
        </Button>
      </div>
    </Card>
  );
}
