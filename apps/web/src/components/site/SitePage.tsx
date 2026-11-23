import { SiteFooter, SiteHeader } from "./SiteChrome";
import { About, Contact, DraftPlaceholder, Faq, Hero, Portfolio, ServiceAreas, Services, Team, Testimonials, Themed } from "./SiteSections";
import type { PublicSite } from "./types";

/**
 * The full public site layout. Purely presentational (no server-only APIs), so it renders both on the
 * public server page `/site/[slug]` and in the owner's client-side preview at `/app/website/preview`.
 * `preview` disables lead forms and links to live-only pages, and shows placeholders for empty sections
 * (owner-only — the public site never passes `preview`).
 */
export function SiteBody({ site, base, preview }: { site: PublicSite; base: string; preview?: boolean }) {
  return (
    <Themed color={site.settings.theme_color}>
      <SiteHeader site={site} base={base} />
      <main className="flex-1">
        <Hero site={site} base={base} />
        {preview && !site.services.length ? (
          <DraftPlaceholder id="services" eyebrow="What we do" title="Your services will appear here"
            text="List the work you do — remodels, additions, roofing — so visitors know what to ask for." tab="services" cta="Add services" />
        ) : <Services site={site} />}
        {preview && !site.settings.about_body ? (
          <DraftPlaceholder id="about" eyebrow="About us" title="Your company story will appear here"
            text="Tell visitors how you started and why clients choose you." tab="hero" cta="Write your story" />
        ) : <About site={site} />}
        {preview && !site.portfolio.length ? (
          <DraftPlaceholder id="projects" eyebrow="Our work" title="Your projects will appear here"
            text="Finished jobs with photos are what win new work. Add one or import a completed project." tab="portfolio" cta="Add projects" />
        ) : <Portfolio site={site} base={base} preview={preview} />}
        {preview && !site.testimonials.length ? (
          <DraftPlaceholder id="reviews" eyebrow="Testimonials" title="Client reviews will appear here"
            text="Add a few quotes from happy clients to build trust." tab="testimonials" cta="Add reviews" />
        ) : <Testimonials site={site} />}
        {preview && !site.team.length ? (
          <DraftPlaceholder id="team" eyebrow="Our people" title="Your team will appear here"
            text="Introduce the people who'll be on site." tab="team" cta="Add team members" />
        ) : <Team site={site} />}
        {preview && !site.faqs.length ? (
          <DraftPlaceholder id="faq" eyebrow="FAQ" title="Common questions will appear here"
            text="Answer what clients ask you most — timelines, permits, payment." tab="faqs" cta="Add FAQs" />
        ) : <Faq site={site} />}
        <ServiceAreas site={site} />
        <Contact site={site} preview={preview} />
      </main>
      <SiteFooter site={site} base={base} />
    </Themed>
  );
}
