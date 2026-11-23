"use client";

import { useCallback, useEffect, useState } from "react";
import { crm } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Spinner, Textarea, fieldError } from "@/components/ui";
import type { SiteSettings } from "@/components/site/types";
import { CollectionEditor, ImageInput, priceLabel } from "./editors";

type Checklist = { percent: number; done: number; total: number; items: { key: string; label: string; done: boolean; hint: string }[] };
type Importable = { id: number; name: string; site_address: string | null; due_date: string | null };

const TABS = [
  ["branding", "Branding & SEO"],
  ["hero", "Hero & About"],
  ["services", "Services"],
  ["portfolio", "Portfolio"],
  ["testimonials", "Testimonials"],
  ["team", "Team"],
  ["faqs", "FAQ"],
  ["contact", "Contact & areas"],
] as const;
type Tab = (typeof TABS)[number][0];

// Which tab completes each checklist item.
const ITEM_TAB: Record<string, Tab> = {
  logo: "branding", seo: "branding", hero: "hero", about: "hero", services: "services", portfolio: "portfolio",
  testimonial: "testimonials", team: "team", faq: "faqs", contact: "contact", areas: "contact",
};

export default function WebsiteBuilderPage() {
  const { me } = useSession();
  const [tab, setTab] = useState<Tab>("branding");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadChecklist = useCallback(() => {
    crm<Checklist>("/app/website/checklist").then(setChecklist).catch(() => {});
  }, []);

  useEffect(() => {
    crm<SiteSettings>("/app/website/settings").then(setSettings).catch(setError);
    loadChecklist();
  }, [loadChecklist]);

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

  const slug = me?.tenant?.slug;
  const liveUrl = slug ? `/site/${slug}` : null;

  if (error) return <ErrorText error={error} />;
  if (!settings) return <Spinner />;

  const settingsTab = ["branding", "hero", "contact"].includes(tab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website"
        subtitle="Your public company website grows from the content you add here."
        actions={
          <>
            <Button variant={settings.published ? "secondary" : "primary"} disabled={saving} onClick={() => save({ published: !settings.published })}>
              {settings.published ? "Unpublish" : "Publish site"}
            </Button>
            {liveUrl && (
              <a href={liveUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                View live site ↗
              </a>
            )}
          </>
        }
      />

      <ProgressCard checklist={checklist} published={settings.published} url={liveUrl} onPick={(k) => setTab(ITEM_TAB[k] ?? "branding")} />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {settingsTab && (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-6">
          {tab === "branding" && <BrandingForm s={settings} set={set} err={saveError} />}
          {tab === "hero" && <HeroForm s={settings} set={set} err={saveError} />}
          {tab === "contact" && <ContactForm s={settings} set={set} err={saveError} />}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/95 py-3 backdrop-blur">
            <ErrorText error={saveError} />
            {!saveError && savedAt && !dirty && <span className="text-sm text-emerald-600">Saved</span>}
            {dirty && <span className="text-sm text-slate-500">Unsaved changes</span>}
            <Button disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
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

function ProgressCard({ checklist, published, url, onPick }: { checklist: Checklist | null; published: boolean; url: string | null; onPick: (key: string) => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">Website completion</h2>
            <Badge tone={published ? "green" : "amber"}>{published ? "Live" : "Unpublished"}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {checklist ? `${checklist.done} of ${checklist.total} steps done.` : "Loading…"} {url && <span className="font-mono text-xs text-slate-400">{url}</span>}
          </p>
        </div>
        <p className="text-3xl font-bold text-brand-600">{checklist?.percent ?? 0}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${checklist?.percent ?? 0}%` }} />
      </div>
      {checklist && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.items.map((i) => (
            <li key={i.key}>
              <button type="button" onClick={() => onPick(i.key)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${i.done ? "bg-emerald-500 text-white" : "border border-slate-300 text-transparent"}`}>✓</span>
                <span className={i.done ? "text-slate-400 line-through" : "text-slate-700"}>{i.label}</span>
                {!i.done && <span className="ml-auto text-xs text-slate-400">{i.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type FormProps = { s: SiteSettings; set: <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => void; err: unknown };

function BrandingForm({ s, set, err }: FormProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Branding">
        <div className="space-y-4">
          <ImageInput label="Logo" value={s.logo_url} onChange={(u) => set("logo_url", u)} error={fieldError(err, "logo_url")} />
          <Field label="Accent color" error={fieldError(err, "theme_color")}>
            <div className="flex items-center gap-3">
              <input type="color" value={s.theme_color} onChange={(e) => set("theme_color", e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white" />
              <Input value={s.theme_color} onChange={(e) => set("theme_color", e.target.value)} className="max-w-32 font-mono" />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <p className="text-xs text-slate-400">Search preview</p>
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
    <div className="grid gap-6 lg:grid-cols-2">
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Contact details">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              <li key={a} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
                {a}
                <button type="button" aria-label={`Remove ${a}`} onClick={() => set("service_areas", areas.filter((x) => x !== a))} className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">✕</button>
              </li>
            ))}
            {!areas.length && <li className="text-sm text-slate-400">No areas yet.</li>}
          </ul>
        </Card>
        <Card title="Social links">
          <div className="grid gap-4 sm:grid-cols-2">
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
        extraActions={<Button variant="secondary" onClick={show}>Import from completed project</Button>}
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
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
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
