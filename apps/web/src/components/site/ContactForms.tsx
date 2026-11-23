"use client";

import { useState } from "react";

type Errors = Record<string, string[]>;
const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

async function post(path: string, body: Record<string, FormDataEntryValue>) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = res.status === 429 ? "Too many requests — please try again in a minute." : data.message ?? "Something went wrong. Please try again.";
    throw Object.assign(new Error(message), { errors: (data.errors ?? {}) as Errors });
  }
  return data as { message?: string };
}

function useSubmit(path: string) {
  const [state, setState] = useState<{ busy: boolean; done: string | null; error: string | null; errors: Errors }>({ busy: false, done: null, error: null, errors: {} });
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    for (const k of Object.keys(body)) if (body[k] === "") delete body[k];
    setState({ busy: true, done: null, error: null, errors: {} });
    try {
      const res = await post(path, body);
      form.reset();
      setState({ busy: false, done: res.message ?? "Thanks! We'll be in touch shortly.", error: null, errors: {} });
    } catch (err) {
      const e2 = err as Error & { errors?: Errors };
      setState({ busy: false, done: null, error: e2.message, errors: e2.errors ?? {} });
    }
  };
  return { ...state, onSubmit };
}

function F({ label, name, errors, children }: { label: string; name: string; errors: Errors; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {errors[name]?.[0] && <span className="block text-xs text-red-600">{errors[name][0]}</span>}
    </label>
  );
}

/** Honeypot: hidden from humans, bots fill it in. */
const Honeypot = () => (
  <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
    <label>
      Website <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </label>
  </div>
);

function Status({ done, error }: { done: string | null; error: string | null }) {
  if (done) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p>;
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  return null;
}

export function QuoteForm({ slug, services }: { slug: string; services: string[] }) {
  const s = useSubmit(`/public/sites/${slug}/leads`);
  return (
    <form onSubmit={s.onSubmit} className="relative space-y-4">
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Your name *" name="name" errors={s.errors}><input name="name" required maxLength={255} className={input} autoComplete="name" /></F>
        <F label="Phone" name="phone" errors={s.errors}><input name="phone" type="tel" maxLength={50} className={input} autoComplete="tel" /></F>
      </div>
      <F label="Email" name="email" errors={s.errors}><input name="email" type="email" maxLength={255} className={input} autoComplete="email" /></F>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Service needed" name="service" errors={s.errors}>
          <select name="service" className={input} defaultValue="">
            <option value="">Select a service…</option>
            {services.map((t) => <option key={t}>{t}</option>)}
            <option>Other</option>
          </select>
        </F>
        <F label="Project address" name="address" errors={s.errors}><input name="address" maxLength={255} className={input} autoComplete="street-address" /></F>
      </div>
      <F label="Tell us about your project" name="message" errors={s.errors}><textarea name="message" rows={4} maxLength={5000} className={input} /></F>
      <Status done={s.done} error={s.error} />
      <button disabled={s.busy} className="w-full rounded-lg bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60">
        {s.busy ? "Sending…" : "Get my free quote"}
      </button>
      <p className="text-center text-xs text-slate-500">Please give us an email or phone number so we can reply.</p>
    </form>
  );
}

export function BookingForm({ slug, services }: { slug: string; services: string[] }) {
  const s = useSubmit(`/public/sites/${slug}/bookings`);
  return (
    <form onSubmit={s.onSubmit} className="relative space-y-4">
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Your name *" name="name" errors={s.errors}><input name="name" required maxLength={255} className={input} autoComplete="name" /></F>
        <F label="Phone *" name="phone" errors={s.errors}><input name="phone" type="tel" required maxLength={50} className={input} autoComplete="tel" /></F>
      </div>
      <F label="Email" name="email" errors={s.errors}><input name="email" type="email" maxLength={255} className={input} autoComplete="email" /></F>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Preferred date & time *" name="preferred_at" errors={s.errors}><input name="preferred_at" type="datetime-local" required className={input} /></F>
        <F label="Service" name="service" errors={s.errors}>
          <select name="service" className={input} defaultValue="">
            <option value="">Select…</option>
            {services.map((t) => <option key={t}>{t}</option>)}
            <option>Other</option>
          </select>
        </F>
      </div>
      <F label="Notes" name="message" errors={s.errors}><textarea name="message" rows={3} maxLength={5000} className={input} /></F>
      <Status done={s.done} error={s.error} />
      <button disabled={s.busy} className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
        {s.busy ? "Booking…" : "Request site visit"}
      </button>
    </form>
  );
}

/** Tabs between quote and booking when both are available. */
export function ContactTabs({ slug, services, booking }: { slug: string; services: string[]; booking: boolean }) {
  const [tab, setTab] = useState<"quote" | "visit">("quote");
  if (!booking) return <QuoteForm slug={slug} services={services} />;
  return (
    <div>
      <div role="tablist" className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
        {([["quote", "Get a free quote"], ["visit", "Book a site visit"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-md px-3 py-2 transition ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "quote" ? <QuoteForm slug={slug} services={services} /> : <BookingForm slug={slug} services={services} />}
    </div>
  );
}
