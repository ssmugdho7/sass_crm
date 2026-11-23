"use client";

import { useEffect } from "react";
import { useFetch } from "@/lib/useFetch";
import { Badge, ErrorText, Link, Spinner } from "@/components/ui";
import { SiteBody } from "@/components/site/SitePage";
import type { PublicSite } from "@/components/site/types";

/** Owner-only preview of the public website, shown whether or not it is published. */
export default function WebsitePreviewPage() {
  const { data: site, error } = useFetch<PublicSite>("/app/website/preview");

  // Honour #section links from the editor once content has rendered.
  useEffect(() => {
    if (!site || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [site]);

  if (error) return <ErrorText error={error} />;
  if (!site) return <Spinner />;
  const published = site.settings.published;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Website preview</h1>
          <Badge tone={published ? "green" : "amber"}>{published ? "live" : "draft"}</Badge>
          <p className="text-sm text-slate-500">
            {published ? "This is what visitors see." : "Only you can see this — visitors get a “not found” page until you publish."}
          </p>
        </div>
        <div className="flex gap-3 text-sm font-medium">
          {published && (
            <a href={`/site/${site.tenant.slug}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">View live site ↗</a>
          )}
          <Link href="/app/website" className="text-brand-700 hover:underline">← Back to editor</Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <SiteBody site={site} base="/app/website/preview" preview />
      </div>
    </div>
  );
}
