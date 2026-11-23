"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Catalog } from "./catalog";

export type { Catalog, PublicAddon, PublicPlan } from "./catalog";

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
