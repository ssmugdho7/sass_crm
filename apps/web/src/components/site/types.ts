export type SiteSettings = {
  published: boolean;
  theme_color: string;
  logo_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  about_title: string | null;
  about_body: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  service_areas: string[] | null;
  hours: string | null;
  social: { facebook: string | null; instagram: string | null; linkedin: string | null; youtube: string | null } | null;
  seo_title: string | null;
  seo_description: string | null;
  license_info: string | null;
  years_in_business: number | null;
};
export type SiteService = { id: number; title: string; summary: string | null; body: string | null; icon: string | null; image_url: string | null; price_from: number | null; sort: number; is_published: boolean };
export type SitePortfolio = { id: number; title: string; location: string | null; category: string | null; description: string | null; cover_url: string | null; images: string[] | null; completed_on: string | null; project_id?: number | null; sort: number; is_published: boolean };
export type SiteTestimonial = { id: number; author: string; role: string | null; quote: string; rating: number; sort: number; is_published: boolean };
export type SiteTeamMember = { id: number; name: string; role: string | null; photo_url: string | null; bio: string | null; sort: number };
export type SiteFaq = { id: number; question: string; answer: string; sort: number };

export type PublicSite = {
  tenant: { name: string; slug: string };
  settings: SiteSettings;
  services: SiteService[];
  portfolio: SitePortfolio[];
  testimonials: SiteTestimonial[];
  team: SiteTeamMember[];
  faqs: SiteFaq[];
  features: { booking: boolean };
};

const API = process.env.API_URL ?? "http://127.0.0.1:8010";

/** Server-side fetch of a tenant's public site (cached ~60s). Returns null when the site doesn't exist or is unpublished. */
export async function fetchSite(slug: string): Promise<PublicSite | null> {
  const res = await fetch(`${API}/api/public/sites/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60, tags: [`site:${slug}`] },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as PublicSite;
}

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export const formatDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;
