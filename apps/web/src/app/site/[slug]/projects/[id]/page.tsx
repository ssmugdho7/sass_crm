/* eslint-disable @next/next/no-img-element -- tenant images come from arbitrary hosts. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Contact, Themed } from "@/components/site/SiteSections";
import { fetchSite, formatDate } from "@/components/site/types";

export const revalidate = 60;

async function load(params: Promise<{ slug: string; id: string }>) {
  const { slug, id } = await params;
  const site = await fetchSite(slug);
  const project = site?.portfolio.find((p) => String(p.id) === id);
  return site && project ? { site, project } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Project not found" };
  const { site, project } = data;
  return {
    title: `${project.title} — ${site.tenant.name}`,
    description: project.description?.slice(0, 160) ?? `${project.title} by ${site.tenant.name}`,
    openGraph: { images: project.cover_url ? [project.cover_url] : undefined },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const data = await load(params);
  if (!data) notFound();
  const { site, project: p } = data;
  const base = `/site/${site.tenant.slug}`;
  const gallery = [p.cover_url, ...(p.images ?? [])].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
  const others = site.portfolio.filter((x) => x.id !== p.id).slice(0, 3);

  return (
    <Themed color={site.settings.theme_color}>
      <SiteHeader site={site} base={base} />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Link href={`${base}#projects`} className="text-sm font-medium text-[var(--accent)] hover:underline">← All projects</Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              {p.category && <span className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white">{p.category}</span>}
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{p.title}</h1>
              <p className="mt-1 text-slate-500">{[p.location, formatDate(p.completed_on) && `Completed ${formatDate(p.completed_on)}`].filter(Boolean).join(" · ")}</p>
            </div>
            <a href="#contact" className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90">Start a similar project</a>
          </div>
          {gallery[0] && <img src={gallery[0]} alt={p.title} className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover shadow-lg" />}
          {p.description && <p className="mt-8 max-w-3xl whitespace-pre-line text-lg leading-8 text-slate-700">{p.description}</p>}
          {gallery.length > 1 && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.slice(1).map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl">
                  <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-105" />
                </a>
              ))}
            </div>
          )}
          {others.length > 0 && (
            <div className="mt-16">
              <h2 className="text-xl font-bold text-slate-900">More projects</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {others.map((o) => (
                  <Link key={o.id} href={`${base}/projects/${o.id}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {(o.cover_url || o.images?.[0]) && <img src={o.cover_url || o.images![0]} alt={o.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                    <p className="p-3 text-sm font-semibold text-slate-900 group-hover:text-[var(--accent)]">{o.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <Contact site={site} />
      </main>
      <SiteFooter site={site} base={base} />
    </Themed>
  );
}
