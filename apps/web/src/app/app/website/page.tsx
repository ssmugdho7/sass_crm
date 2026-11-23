"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { crm } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Link, Modal, PageHeader, Spinner, Textarea, fieldError } from "@/components/ui";
import type { SiteSettings } from "@/components/site/types";
import { CollectionEditor, ImageInput, priceLabel } from "./editors";

type ChecklistItem = { key: string; label: string; done: boolean; hint: string; tab?: string };
type Checklist = { percent: number; done: number; total: number; items: ChecklistItem[] };
type Importable = { id: number; name: string; site_address: string | null; due_date: string | null };

// [tab key, label, public-site section anchor ("" = top of page)]
const TABS = [
  ["branding", "Branding & SEO", ""],
  ["hero", "Hero & About", "about"],
  ["services", "Services", "services"],
  ["portfolio", "Portfolio", "projects"],
  ["testimonials", "Testimonials", "reviews"],
  ["team", "Team", "team"],
  ["faqs", "FAQ", "faq"],
  ["contact", "Contact & areas", "contact"],
] as const;
type Tab = (typeof TABS)[number][0];
const isTab = (t: unknown): t is Tab => TABS.some(([k]) => k === t);

// Fallback when the API doesn't send `tab` for a checklist item.
const ITEM_TAB: Record<string, Tab> = {
  logo: "branding", seo: "branding", hero: "hero", about: "hero", services: "services", portfolio: "portfolio",
  testimonial: "testimonials", team: "team", faq: "faqs", contact: "contact", areas: "contact",
};
const itemTab = (i: ChecklistItem): Tab => (isTab(i.tab) ? i.tab : ITEM_TAB[i.key] ?? "branding");

// Publishing a near-empty site looks broken to visitors, so require a few basics first.
const PUBLISH_MIN_DONE = 3;

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export default function Page() {
  return <Suspense fallback={<Spinner />}><WebsiteBuilderPage /></Suspense>;
}

function WebsiteBuilderPage() {
  const { me } = useSession();
  const params = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTabState] = useState<Tab>(isTab(initialTab) ? initialTab : "branding");
  // Keep ?tab= in the URL so links like /app/website?tab=services (from the draft preview) and reloads land on the right tab.
  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };
  const { data: settings, setData: setSettings, error } = useFetch<SiteSettings>("/app/website/settings");
  const { data: checklist, reload: loadChecklist } = useFetch<Checklist>("/app/website/checklist");
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setSettings((s) => (s ? { ...s, [k]: v } : s));
    setDirty(true);
  };

  const save = async (patch?: Partial<SiteSettings>) => {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await crm<SiteSettings>("/app/website/settings", { method: "PUT", body: { ...settings, ...patch } });
      setSettings(next);
      setDirty(false);
      setSavedAt(Date.now());
      loadChecklist();
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  const goTo = (t: Tab) => {
    setTab(t);
    requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${t}"]`)?.focus({ preventScroll: true });
    });
  };

  const slug = me?.tenant?.slug;
  const liveUrl = slug ? `/site/${slug}` : null;

  if (error) return <ErrorText error={error} />;
  if (!settings) return <Spinner />;

  const doneCount = checklist?.done ?? 0;
  const canPublish = !!checklist && doneCount >= PUBLISH_MIN_DONE;
  const publishBlocker = !checklist
    ? "Checking your website…"
    : canPublish
      ? null
      : `Complete at least ${PUBLISH_MIN_DONE} checklist steps before publishing (${doneCount}/${PUBLISH_MIN_DONE} done).`;
  const unpublish = async () => {
    await save({ published: false });
    setConfirmUnpublish(false);
  };

  const settingsTab = ["branding", "hero", "contact"].includes(tab);
  const showSaveBar = settingsTab && (dirty || saving || !!saveError);
  const [, tabLabel, anchor] = TABS.find(([k]) => k === tab)!;

  return (
    <div className={`min-w-0 space-y-6 ${showSaveBar ? "pb-16" : ""}`}>
      <PageHeader
        title="Website"
        subtitle="Your public company website grows from the content you add here."
        actions={
          <>
            <Link href="/app/website/preview"
              className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}>
              Preview
            </Link>
            {settings.published ? (
              <>
                <Button variant="secondary" disabled={saving} onClick={() => setConfirmUnpublish(true)}>Unpublish</Button>
                {liveUrl && (
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 ${focusRing}`}>
                    View live site ↗
                  </a>
                )}
              </>
            ) : (
              <Button disabled={saving || !canPublish} title={publishBlocker ?? undefined} aria-describedby="publish-hint" onClick={() => save({ published: true })}>
                {saving ? "Publishing…" : "Publish website"}
              </Button>
            )}
          </>
        }
      />

      {!settings.published && (
        <div role="status" className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Badge tone="amber">draft</Badge>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900">Draft — not visible to visitors yet</p>
            <p id="publish-hint" className="mt-0.5 text-amber-800">
              {publishBlocker ?? "Looking good! Preview it, then publish when you're ready for visitors."}
            </p>
          </div>
        </div>
      )}
      {/* Settings tabs show save errors in their footer; surface publish errors everywhere else. */}
      {!settingsTab && !confirmUnpublish && <ErrorText error={saveError} />}

      <Modal open={confirmUnpublish} title="Unpublish your website?" onClose={() => setConfirmUnpublish(false)}>
        <p className="text-sm text-slate-600">
          Your website will go offline for visitors and search engines, and the quote form will stop collecting leads.
          Your content is kept — you can publish again at any time.
        </p>
        <ErrorText error={saveError} />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmUnpublish(false)}>Keep it live</Button>
          <Button variant="danger" disabled={saving} onClick={unpublish}>{saving ? "Unpublishing…" : "Unpublish"}</Button>
        </div>
      </Modal>

      <ProgressCard checklist={checklist} published={settings.published} url={liveUrl} onPick={(i) => goTo(itemTab(i))} />

      <div ref={tabsRef} className="scroll-mt-4 space-y-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1" role="tablist" aria-label="Website sections">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" data-tab={k} aria-selected={tab === k} onClick={() => setTab(k)}
              className={`shrink-0 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition ${focusRing} ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>
        {liveUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-slate-500">
              {tabLabel} appears on your public website{settings.published ? "" : " once you publish it"}.
            </p>
            <Link href={`/app/website/preview${anchor ? `#${anchor}` : ""}`}
              className={`rounded font-medium text-brand-700 hover:underline ${focusRing}`}>
              Preview this section →
            </Link>
          </div>
        )}
      </div>

      {settingsTab && (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-6">
          {tab === "branding" && <BrandingForm s={settings} set={set} err={saveError} />}
          {tab === "hero" && <HeroForm s={settings} set={set} err={saveError} />}
          {tab === "contact" && <ContactForm s={settings} set={set} err={saveError} />}
          {showSaveBar ? (
            <div className="sticky bottom-0 z-20 flex min-h-16 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.12)] rounded-t-lg">
              <ErrorText error={saveError} />
              {dirty && <span className="mr-auto text-sm text-slate-600">You have unsaved changes</span>}
              <Button disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          ) : (
            savedAt && <p role="status" className="text-right text-sm text-emerald-700">All changes saved</p>
          )}
        </form>
      )}

      {tab === "services" && (
        <CollectionEditor collection="services" title="Services" onChanged={loadChecklist}
          empty="No services yet. Add at least 3 to show what you do."
          summary={(r) => ({ primary: String(r.title), secondary: [r.summary as string | null, priceLabel(r.price_from)].filter(Boolean).join(" · "), image: (r.image_url as string | null) ?? null })}
          fields={[
            { key: "title", label: "Service name", required: true, placeholder: "Kitchen remodeling" },
            { key: "summary", label: "Short summary", placeholder: "One line shown on the card" },
            { key: "body", label: "Details", type: "textarea" },
            { key: "icon", label: "Icon", type: "icon" },
            { key: "image_url", label: "Photo", type: "image" },
            { key: "price_from", label: "Starting price (USD, optional)", type: "money" },
            { key: "is_published", label: "Show on website", type: "bool" },
          ]} />
      )}

      {tab === "portfolio" && <PortfolioTab onChanged={loadChecklist} />}

      {tab === "testimonials" && (
        <CollectionEditor collection="testimonials" title="Testimonials" onChanged={loadChecklist}
          empty="No testimonials yet. Happy clients are your best sales team."
          summary={(r) => ({ primary: `${"★".repeat(Number(r.rating))} ${r.author}`, secondary: String(r.quote) })}
          fields={[
            { key: "author", label: "Client name", required: true },
            { key: "role", label: "Role or location", placeholder: "Homeowner, Springfield" },
            { key: "quote", label: "Quote", type: "textarea", required: true },
            { key: "rating", label: "Rating", type: "rating" },
            { key: "is_published", label: "Show on website", type: "bool" },
          ]} />
      )}

      {tab === "team" && (
        <CollectionEditor collection="team" title="Team" onChanged={loadChecklist}
          empty="Introduce the people behind your work."
          summary={(r) => ({ primary: String(r.name), secondary: r.role as string | null, image: (r.photo_url as string | null) ?? null })}
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "role", label: "Role", placeholder: "Site superintendent" },
            { key: "photo_url", label: "Photo", type: "image" },
            { key: "bio", label: "Short bio", type: "textarea" },
          ]} />
      )}

      {tab === "faqs" && (
        <CollectionEditor collection="faqs" title="FAQ" onChanged={loadChecklist}
          empty="Answer the questions clients ask you most."
          summary={(r) => ({ primary: String(r.question), secondary: String(r.answer) })}
          fields={[
            { key: "question", label: "Question", required: true },
            { key: "answer", label: "Answer", type: "textarea", required: true },
          ]} />
      )}
    </div>
  );
}

function ProgressCard({ checklist, published, url, onPick }: { checklist: Checklist | null; published: boolean; url: string | null; onPick: (item: ChecklistItem) => void }) {
  const percent = checklist?.percent ?? 0;
  const remaining = checklist?.items.filter((i) => !i.done) ?? [];
  const finished = checklist?.items.filter((i) => i.done) ?? [];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">Website completion</h2>
            <Badge tone={published ? "green" : "amber"}>{published ? "live" : "draft"}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">Every service, project and review you add here appears on your public website.</p>
          {url && <p className="mt-1 break-all font-mono text-xs text-slate-500">{url}</p>}
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-3xl font-bold text-brand-600">{percent}%</span>
          <span className="text-xs text-slate-500">complete</span>
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Website completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      {!checklist ? (
        <p className="mt-4 text-sm text-slate-500">Loading checklist…</p>
      ) : (
        <div className="mt-5 space-y-5">
          {remaining.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Next steps · {remaining.length} left
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {remaining.map((i) => (
                  <li key={i.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" aria-hidden />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="text-sm font-medium text-slate-800">{i.label}</p>
                      <p className="text-xs text-slate-500">{i.hint}</p>
                    </div>
                    <Button type="button" variant="secondary" className="px-3 py-1.5" onClick={() => onPick(i)} aria-label={`Do it: ${i.label}`}>
                      Do it →
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">All steps done — your website is complete. Keep adding projects and reviews as you win them.</p>
          )}
          {finished.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Done · {finished.length}</h3>
              <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {finished.map((i) => (
                  <li key={i.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white" aria-hidden>✓</span>
                    <span className="min-w-0">{i.label}</span>
                    <span className="sr-only">(done)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

type FormProps = { s: SiteSettings; set: <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => void; err: unknown };

function BrandingForm({ s, set, err }: FormProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Card title="Branding">
        <div className="space-y-4">
          <ImageInput label="Logo" value={s.logo_url} onChange={(u) => set("logo_url", u)} error={fieldError(err, "logo_url")} />
          <Field label="Accent color" error={fieldError(err, "theme_color")}>
            <div className="flex items-center gap-3">
              <input type="color" aria-label="Pick accent color" value={s.theme_color} onChange={(e) => set("theme_color", e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white" />
              <Input value={s.theme_color} onChange={(e) => set("theme_color", e.target.value)} className="max-w-32 font-mono" />
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="License / insurance" error={fieldError(err, "license_info")}>
              <Input value={s.license_info ?? ""} onChange={(e) => set("license_info", e.target.value)} placeholder="License #12345 · Fully insured" />
            </Field>
            <Field label="Years in business" error={fieldError(err, "years_in_business")}>
              <Input type="number" min={0} value={s.years_in_business ?? ""} onChange={(e) => set("years_in_business", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
          </div>
        </div>
      </Card>
      <Card title="Search engines (SEO)">
        <div className="space-y-4">
          <Field label="Page title" error={fieldError(err, "seo_title")}>
            <Input value={s.seo_title ?? ""} maxLength={255} onChange={(e) => set("seo_title", e.target.value)} />
          </Field>
          <Field label="Meta description" error={fieldError(err, "seo_description")}>
            <Textarea value={s.seo_description ?? ""} maxLength={500} onChange={(e) => set("seo_description", e.target.value)} />
          </Field>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Search preview</p>
            <p className="mt-1 truncate text-lg text-blue-700">{s.seo_title || "Your company name"}</p>
            <p className="line-clamp-2 text-sm text-slate-600">{s.seo_description || "Add a description to tell searchers what you do and where."}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function HeroForm({ s, set, err }: FormProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Card title="Hero banner">
        <div className="space-y-4">
          <Field label="Headline" error={fieldError(err, "hero_title")}>
            <Input value={s.hero_title ?? ""} onChange={(e) => set("hero_title", e.target.value)} />
          </Field>
          <Field label="Subheadline" error={fieldError(err, "hero_subtitle")}>
            <Textarea value={s.hero_subtitle ?? ""} maxLength={500} onChange={(e) => set("hero_subtitle", e.target.value)} />
          </Field>
          <ImageInput label="Background photo" value={s.hero_image_url} onChange={(u) => set("hero_image_url", u)} error={fieldError(err, "hero_image_url")} />
        </div>
      </Card>
      <Card title="About your company">
        <div className="space-y-4">
          <Field label="Section title" error={fieldError(err, "about_title")}>
            <Input value={s.about_title ?? ""} onChange={(e) => set("about_title", e.target.value)} />
          </Field>
          <Field label="Your story" error={fieldError(err, "about_body")}>
            <Textarea rows={9} value={s.about_body ?? ""} onChange={(e) => set("about_body", e.target.value)} placeholder="How you started, what you specialise in, why clients choose you. Blank lines start new paragraphs." />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function ContactForm({ s, set, err }: FormProps) {
  const [area, setArea] = useState("");
  const areas = s.service_areas ?? [];
  const addArea = () => {
    const a = area.trim();
    if (a && !areas.includes(a)) set("service_areas", [...areas, a]);
    setArea("");
  };
  const social = s.social ?? { facebook: null, instagram: null, linkedin: null, youtube: null };
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Card title="Contact details">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone" error={fieldError(err, "phone")}><Input value={s.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Email" error={fieldError(err, "email")}><Input type="email" value={s.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
          <Field label="Office address" error={fieldError(err, "address")}><Input value={s.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Opening hours" error={fieldError(err, "hours")}><Input value={s.hours ?? ""} onChange={(e) => set("hours", e.target.value)} placeholder="Mon–Fri 7:00–17:00" /></Field>
          <p className="text-xs text-slate-500">Quote requests from your website arrive in <strong>Leads</strong> with source “website”.</p>
        </div>
      </Card>
      <div className="space-y-6">
        <Card title="Service areas">
          <div className="flex gap-2">
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="City or neighbourhood"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }} />
            <Button type="button" variant="secondary" onClick={addArea}>Add</Button>
          </div>
          <ErrorText error={fieldError(err, "service_areas")} />
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a} className="inline-flex max-w-full items-center break-all gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
                {a}
                <button type="button" aria-label={`Remove ${a}`} onClick={() => set("service_areas", areas.filter((x) => x !== a))} className={`rounded-full px-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 ${focusRing}`}>✕</button>
              </li>
            ))}
            {!areas.length && <li className="text-sm text-slate-500">No areas yet.</li>}
          </ul>
        </Card>
        <Card title="Social links">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["facebook", "instagram", "linkedin", "youtube"] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)} error={fieldError(err, `social.${k}`)}>
                <Input type="url" value={social[k] ?? ""} placeholder="https://" onChange={(e) => set("social", { ...social, [k]: e.target.value || null })} />
              </Field>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PortfolioTab({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Importable[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const show = async () => {
    setOpen(true);
    setProjects(null);
    setError(null);
    try {
      setProjects(await crm<Importable[]>("/app/website/portfolio/importable-projects"));
    } catch (e) {
      setError(e);
    }
  };
  const importOne = async (id: number) => {
    setBusy(id);
    setError(null);
    try {
      await crm(`/app/website/portfolio/from-project/${id}`, { method: "POST" });
      setProjects((p) => p?.filter((x) => x.id !== id) ?? null);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <CollectionEditor collection="portfolio" title="Portfolio" onChanged={onChanged} reloadKey={reloadKey}
        empty="Showcase your finished jobs with photos — it's what wins new work."
        extraActions={<Button variant="secondary" onClick={show}>Import from project</Button>}
        summary={(r) => ({
          primary: String(r.title),
          secondary: [r.category, r.location, Array.isArray(r.images) ? `${r.images.length} photos` : null].filter(Boolean).join(" · "),
          image: (r.cover_url as string | null) ?? null,
        })}
        fields={[
          { key: "title", label: "Project title", required: true },
          { key: "category", label: "Category", placeholder: "Kitchen, Custom home, Commercial…" },
          { key: "location", label: "Location (area, not street address)", placeholder: "Springfield, IL" },
          { key: "completed_on", label: "Completed on", type: "date" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "cover_url", label: "Cover photo", type: "image" },
          { key: "images", label: "Gallery", type: "images" },
          { key: "is_published", label: "Show on website", type: "bool" },
        ]} />
      <Modal open={open} title="Import a completed project" onClose={() => setOpen(false)}>
        <p className="mb-4 text-sm text-slate-500">Creates a draft portfolio entry from the job. Add photos, then publish it.</p>
        <ErrorText error={error} />
        {!projects ? (
          !error && <Spinner />
        ) : !projects.length ? (
          <p className="py-6 text-center text-sm text-slate-500">No completed projects left to import. Mark a job as completed in Projects first.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{p.name}</p>
                  {p.site_address && <p className="truncate text-sm text-slate-500">{p.site_address}</p>}
                </div>
                <Button variant="secondary" disabled={busy === p.id} onClick={() => importOne(p.id)}>{busy === p.id ? "Importing…" : "Import"}</Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
