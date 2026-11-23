// Server-safe plan catalog types + fetch (no "use client"), shared by the SSR pricing and the client register page.

export type PublicPlan = {
  id: number;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  features: string[] | null;
  included_modules: string[] | null;
};
export type PublicAddon = { key: string; name: string; description: string; price: number };
export type Catalog = { plans: PublicPlan[]; addons: PublicAddon[] };

const API = process.env.API_URL ?? "http://127.0.0.1:8010";

/** Server-side GET /api/public/plans, cached ~5 min. Returns null if the API is unreachable or errors. */
export async function fetchCatalog(): Promise<Catalog | null> {
  try {
    const res = await fetch(`${API}/api/public/plans`, { headers: { Accept: "application/json" }, next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as Catalog;
    return Array.isArray(data?.plans) ? { plans: data.plans, addons: Array.isArray(data.addons) ? data.addons : [] } : null;
  } catch {
    return null;
  }
}
