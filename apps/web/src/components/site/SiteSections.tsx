/* eslint-disable @next/next/no-img-element -- tenant images come from arbitrary hosts; render with plain <img>. */
import Link from "next/link";
import { ContactTabs } from "./ContactForms";
import { formatDate, formatPrice, type PublicSite } from "./types";

const Section = ({ id, eyebrow, title, intro, dark, children }: { id: string; eyebrow: string; title: string; intro?: string; dark?: boolean; children: React.ReactNode }) => (
  <section id={id} className={`scroll-mt-20 py-20 ${dark ? "bg-slate-900 text-white" : ""}`}>
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">{eyebrow}</p>
      <h2 className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
      {intro && <p className={`mt-3 max-w-2xl ${dark ? "text-slate-300" : "text-slate-600"}`}>{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

const Stars = ({ n }: { n: number }) => (
  <div className="flex gap-0.5 text-amber-400" aria-label={`${n} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} viewBox="0 0 20 20" className={`h-4 w-4 ${i <= n ? "fill-current" : "fill-slate-300"}`} aria-hidden>
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
    ))}
  </div>
);

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  kitchen: "M4 3h16v18H4zM4 9h16M8 6h.01M8 13v4",
  bath: "M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5a2 2 0 0 1 4 0",
  addition: "M3 21V9l9-6 9 6v12M12 10v6M9 13h6",
  roof: "M2 12 12 4l10 8M5 10v10h14V10",
  commercial: "M4 21V5h10v16M14 9h6v12M7 8h4M7 12h4M7 16h4",
  default: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z",
};
const Icon = ({ name }: { name: string | null }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name ?? ""] ?? ICONS.default} />
  </svg>
);

/** Shown for portfolio items without photos: theme-colored gradient, icon and category. */
export const ProjectPlaceholder = ({ category }: { category: string | null }) => (
  <div aria-hidden className="relative flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 overflow-hidden bg-[linear-gradient(135deg,var(--accent),#0f172a_85%)] pb-20 text-white">
    <div className="absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(45deg,#fff_0,#fff_1px,transparent_1px,transparent_14px)]" />
    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
      <Icon name={iconFor(category)} />
    </span>
    {category && <span className="relative text-xs font-semibold uppercase tracking-widest text-white/80">{category}</span>}
  </div>
);
const iconFor = (category: string | null) => {
  const c = (category ?? "").toLowerCase();
  return (["kitchen", "bath", "roof", "commercial", "addition"] as const).find((k) => c.includes(k)) ?? "home";
};

export function Hero({ site, base }: { site: PublicSite; base: string }) {
  const s = site.settings;
  const stats = [
    s.years_in_business ? [`${s.years_in_business}+`, "Years in business"] : null,
    site.portfolio.length ? [`${site.portfolio.length}`, "Featured projects"] : null,
    site.testimonials.length
      ? [(site.testimonials.reduce((a, t) => a + t.rating, 0) / site.testimonials.length).toFixed(1) + "★", "Client rating"]
      : null,
  ].filter(Boolean) as [string, string][];
  return (
    <section className="relative isolate overflow-hidden bg-slate-900">
      {s.hero_image_url && <img src={s.hero_image_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-900/20" />
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
        <div className="max-w-2xl">
          {s.license_info && (
            <p className="mb-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20">{s.license_info}</p>
          )}
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            {s.hero_title || site.tenant.name}
          </h1>
          {s.hero_subtitle && <p className="mt-6 text-lg leading-8 text-slate-200">{s.hero_subtitle}</p>}
          <div className="mt-10 flex flex-wrap gap-4">
            <a href={`${base}#contact`} className="rounded-lg bg-[var(--accent)] px-6 py-3.5 font-semibold text-white shadow-lg hover:opacity-90">
              Get a free quote
            </a>
            {site.features.booking ? (
              <a href={`${base}#contact`} className="rounded-lg bg-white/10 px-6 py-3.5 font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20">
                Book a site visit
              </a>
            ) : site.portfolio.length ? (
              <a href={`${base}#projects`} className="rounded-lg bg-white/10 px-6 py-3.5 font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20">
                See our work
              </a>
            ) : null}
          </div>
          {stats.length > 0 && (
            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-8">
              {stats.map(([v, l]) => (
                <div key={l}>
                  <dt className="text-xs text-slate-300">{l}</dt>
                  <dd className="mt-1 text-2xl font-bold text-white">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

export function Services({ site }: { site: PublicSite }) {
  if (!site.services.length) return null;
  return (
    <Section id="services" eyebrow="What we do" title="Our services" intro="One accountable team from first sketch to final walkthrough.">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {site.services.map((sv) => (
          <article key={sv.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            {sv.image_url && (
              <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                <img src={sv.image_url} alt={sv.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name={sv.icon} /></span>
                <h3 className="text-lg font-semibold text-slate-900">{sv.title}</h3>
              </div>
              {sv.summary && <p className="mt-3 text-sm leading-6 text-slate-600">{sv.summary}</p>}
              {sv.body && <p className="mt-2 text-sm leading-6 text-slate-500">{sv.body}</p>}
              {sv.price_from ? <p className="mt-auto pt-4 text-sm font-semibold text-slate-900">From {formatPrice(sv.price_from)}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function Portfolio({ site, base, preview }: { site: PublicSite; base: string; preview?: boolean }) {
  if (!site.portfolio.length) return null;
  return (
    <Section id="projects" eyebrow="Our work" title="Recent projects" intro="A few of the homes and spaces we're proud to have built.">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {site.portfolio.map((p, i) => (
          <PortfolioCard key={p.id} href={preview ? null : `${base}/projects/${p.id}`}
            className={`group relative block overflow-hidden rounded-2xl bg-slate-200 ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
            <div className={i === 0 ? "aspect-[4/3] h-full sm:aspect-auto" : "aspect-[4/3]"}>
              {p.cover_url || p.images?.[0] ? (
                <img src={p.cover_url || p.images![0]} alt={p.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <ProjectPlaceholder category={p.category} />
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-5 pt-16">
              {p.category && <span className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white">{p.category}</span>}
              <h3 className="mt-2 text-lg font-semibold text-white">{p.title}</h3>
              <p className="text-sm text-slate-300">{[p.location, formatDate(p.completed_on)].filter(Boolean).join(" · ")}</p>
            </div>
          </PortfolioCard>
        ))}
      </div>
    </Section>
  );
}

/** Project detail pages only exist on the live site, so the owner preview renders plain cards. */
const PortfolioCard = ({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) =>
  href ? <Link href={href} className={className}>{children}</Link> : <div className={className}>{children}</div>;

export function About({ site }: { site: PublicSite }) {
  const s = site.settings;
  if (!s.about_body) return null;
  const photo = site.portfolio[1]?.cover_url ?? site.portfolio[0]?.cover_url ?? s.hero_image_url;
  return (
    <section id="about" className="scroll-mt-20 bg-white py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">About us</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{s.about_title || `About ${site.tenant.name}`}</h2>
          <div className="mt-6 space-y-4 leading-7 text-slate-600">
            {s.about_body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <ul className="mt-8 grid gap-3 text-sm font-medium text-slate-800 sm:grid-cols-2">
            {["Free, detailed estimates", "Licensed & insured crews", "Clean, safe job sites", "Workmanship warranty"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-xs text-white">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        {photo && <img src={photo} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl" />}
      </div>
    </section>
  );
}

export function Testimonials({ site }: { site: PublicSite }) {
  if (!site.testimonials.length) return null;
  return (
    <Section id="reviews" eyebrow="Testimonials" title="What our clients say" dark>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {site.testimonials.map((t) => (
          <figure key={t.id} className="flex flex-col rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <Stars n={t.rating} />
            <blockquote className="mt-4 flex-1 leading-7 text-slate-200">“{t.quote}”</blockquote>
            <figcaption className="mt-6">
              <p className="font-semibold text-white">{t.author}</p>
              {t.role && <p className="text-sm text-slate-500">{t.role}</p>}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

export function Team({ site }: { site: PublicSite }) {
  if (!site.team.length) return null;
  return (
    <Section id="team" eyebrow="Our people" title="Meet the team">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {site.team.map((m) => (
          <div key={m.id} className="text-center">
            {m.photo_url ? (
              <img src={m.photo_url} alt={m.name} loading="lazy" className="mx-auto aspect-square w-40 rounded-full object-cover shadow-md" />
            ) : (
              <div className="mx-auto flex aspect-square w-40 items-center justify-center rounded-full bg-[var(--accent-soft)] text-4xl font-bold text-[var(--accent)]">
                {m.name.charAt(0)}
              </div>
            )}
            <h3 className="mt-4 font-semibold text-slate-900">{m.name}</h3>
            {m.role && <p className="text-sm text-[var(--accent)]">{m.role}</p>}
            {m.bio && <p className="mt-2 text-sm text-slate-600">{m.bio}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Faq({ site }: { site: PublicSite }) {
  if (!site.faqs.length) return null;
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">FAQ</p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {site.faqs.map((f) => (
            <details key={f.id} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                {f.question}
                <span className="text-xl text-[var(--accent)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServiceAreas({ site }: { site: PublicSite }) {
  const areas = site.settings.service_areas ?? [];
  if (!areas.length) return null;
  return (
    <section className="bg-[var(--accent-soft)] py-14">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Proudly serving</h2>
        <ul className="mt-6 flex flex-wrap justify-center gap-3">
          {areas.map((a) => (
            <li key={a} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200">📍 {a}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Contact({ site, preview }: { site: PublicSite; preview?: boolean }) {
  const s = site.settings;
  const rows = [
    s.phone && ["Call us", <a key="p" href={`tel:${s.phone}`} className="hover:underline">{s.phone}</a>],
    s.email && ["Email", <a key="e" href={`mailto:${s.email}`} className="hover:underline">{s.email}</a>],
    s.address && ["Office", s.address],
    s.hours && ["Hours", s.hours],
  ].filter(Boolean) as [string, React.ReactNode][];
  return (
    <section id="contact" className="scroll-mt-20 py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">Contact</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Let&apos;s talk about your project</h2>
          <p className="mt-4 text-slate-600">
            Tell us what you have in mind and we&apos;ll get back to you within one business day with next steps
            {site.features.booking ? " — or book a site visit at a time that suits you." : "."}
          </p>
          {rows.length > 0 && (
            <dl className="mt-8 space-y-5">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
                  <dd className="mt-1 font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8 lg:col-span-3">
          {preview && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Preview — the form is disabled here so no test leads are created.</p>
          )}
          <fieldset disabled={preview} className="disabled:opacity-70">
            <ContactTabs slug={site.tenant.slug} services={site.services.map((x) => x.title)} booking={site.features.booking} />
          </fieldset>
        </div>
      </div>
    </section>
  );
}

/** Applies the tenant's accent color as CSS variables for everything below. */
export function Themed({ color, children }: { color: string; children: React.ReactNode }) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ea580c";
  return (
    <div style={{ "--accent": accent, "--accent-soft": `${accent}1a` } as React.CSSProperties} className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {children}
    </div>
  );
}
