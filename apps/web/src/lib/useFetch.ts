"use client";

import { useCallback, useEffect, useState } from "react";
import { crm, platform } from "./api";

/** Load a GET endpoint for the crm (default) or platform realm. Pass null to skip. */
export function useFetch<T>(path: string | null, realm: "crm" | "platform" = "crm") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!path) return;
    let live = true;
    (realm === "crm" ? crm<T>(path) : platform<T>(path))
      .then((r) => {
        if (!live) return;
        setData(r);
        setError(null);
      })
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, realm, tick]);
  return { data, error, loading, reload, setData };
}
