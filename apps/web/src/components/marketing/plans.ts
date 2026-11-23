"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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

/** Loads GET /api/public/plans once on mount. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let alive = true;
    api<Catalog>("/public/plans")
      .then((c) => alive && setCatalog(c))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, []);
  return { catalog, error };
}
