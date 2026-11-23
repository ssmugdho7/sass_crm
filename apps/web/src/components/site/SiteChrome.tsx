import Link from "next/link";
import type { PublicSite } from "./types";

/** Header with logo/name, anchor nav and a call-to-action. */
export function SiteHeader({ site, base }: { site: PublicSite; base: string }) {
  const { settings: s } = site;
  const links: [string, string, boolean][] = [
    ["Services", "#services", site.services.length > 0],
    ["Projects", "#projects", site.portfolio.length > 0],
    ["About", "#about", !!s.about_body],
    ["Reviews", "#reviews", site.testimonials.length > 0],
    ["FAQ", "#faq", site.faqs.length > 0],
    ["Contact", "#contact", true],
  ];
  const visible = links.filter(([, , show]) => show);
  const sparse = visible.length <= 2; // few links fit on small tablets too
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={base} className="flex min-w-0 items-center gap-3">
          {s.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logo_url} alt={`${site.tenant.name} logo`} className="h-9 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-lg font-bold text-[var(--on-accent)]">
              {site.tenant.name.charAt(0)}
            </span>
          )}
          <span className="truncate text-lg font-bold text-slate-900">{site.tenant.name}</span>
        </Link>
        {/* Section links appear as content is added; Contact + the quote CTA are always there so a new site never looks broken. */}
        <nav aria-label="Main" className={`hidden items-center gap-6 text-sm font-medium text-slate-600 ${sparse ? "sm:flex" : "md:flex"}`}>
          {visible.map(([label, hash]) => (
            <a key={hash} href={`${base}${hash}`} className="hover:text-[var(--accent)]">{label}</a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {s.phone && (
            <a href={`tel:${s.phone}`} className="hidden text-sm font-semibold text-slate-800 lg:block">{s.phone}</a>
          )}
          <a href={`${base}#contact`} className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] shadow-sm hover:brightness-95">
            Get a quote
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ site, base }: { site: PublicSite; base: string }) {
  const { settings: s } = site;
  const social = Object.entries(s.social ?? {}).filter(([, url]) => !!url) as [string, string][];
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-white">{site.tenant.name}</p>
          {s.license_info && <p className="mt-2 text-sm">{s.license_info}</p>}
          {s.years_in_business ? <p className="mt-1 text-sm">Serving clients for {s.years_in_business}+ years</p> : null}
        </div>
        <div className="space-y-1 text-sm">
          <p className="mb-2 font-semibold text-white">Contact</p>
          {s.phone && <p><a href={`tel:${s.phone}`} className="hover:text-white">{s.phone}</a></p>}
          {s.email && <p><a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a></p>}
          {s.address && <p>{s.address}</p>}
          {s.hours && <p>{s.hours}</p>}
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Explore</p>
          <ul className="space-y-1">
            {site.services.length > 0 && <li><a href={`${base}#services`} className="hover:text-white">Services</a></li>}
            {site.portfolio.length > 0 && <li><a href={`${base}#projects`} className="hover:text-white">Projects</a></li>}
            <li><a href={`${base}#contact`} className="hover:text-white">Request a quote</a></li>
          </ul>
          {social.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {social.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-700 px-2.5 py-1 capitalize hover:border-slate-500 hover:text-white">
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs sm:px-6">
          <p>© {new Date().getFullYear()} {site.tenant.name}. All rights reserved.</p>
          <p>
            Powered by{" "}
            <Link href="/" className="font-semibold text-slate-300 hover:text-white">BuildCRM</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
