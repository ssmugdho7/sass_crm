import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteBody } from "@/components/site/SitePage";
import { fetchSite } from "@/components/site/types";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await fetchSite(slug);
  if (!site) return { title: "Site not found" };
  const s = site.settings;
  const title = s.seo_title || site.tenant.name;
  const description = s.seo_description || s.hero_subtitle || `${site.tenant.name} — construction services.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: site.tenant.name, images: s.hero_image_url ? [s.hero_image_url] : undefined },
    icons: s.logo_url ? { icon: s.logo_url } : undefined,
  };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await fetchSite(slug);
  if (!site) notFound();
  const base = `/site/${site.tenant.slug}`;
  const s = site.settings;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    name: site.tenant.name,
    description: s.seo_description ?? undefined,
    telephone: s.phone ?? undefined,
    email: s.email ?? undefined,
    address: s.address ?? undefined,
    image: s.hero_image_url ?? undefined,
    areaServed: s.service_areas?.length ? s.service_areas : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteBody site={site} base={base} />
    </>
  );
}
