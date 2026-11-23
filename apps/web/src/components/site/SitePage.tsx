import { SiteFooter, SiteHeader } from "./SiteChrome";
import { About, Contact, Faq, Hero, Portfolio, ServiceAreas, Services, Team, Testimonials, Themed } from "./SiteSections";
import type { PublicSite } from "./types";

/**
 * The full public site layout. Purely presentational (no server-only APIs), so it renders both on the
 * public server page `/site/[slug]` and in the owner's client-side preview at `/app/website/preview`.
 * `preview` disables lead forms and links to live-only pages.
 */
export function SiteBody({ site, base, preview }: { site: PublicSite; base: string; preview?: boolean }) {
  return (
    <Themed color={site.settings.theme_color}>
      <SiteHeader site={site} base={base} />
      <main className="flex-1">
        <Hero site={site} base={base} />
        <Services site={site} />
        <About site={site} />
        <Portfolio site={site} base={base} preview={preview} />
        <Testimonials site={site} />
        <Team site={site} />
        <Faq site={site} />
        <ServiceAreas site={site} />
        <Contact site={site} preview={preview} />
      </main>
      <SiteFooter site={site} base={base} />
    </Themed>
  );
}
