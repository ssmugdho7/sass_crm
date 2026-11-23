"use client";

import { useState } from "react";

/** Copy a public document link; returns [copied, copy]. */
export function useCopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async (path: string) => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return [copied, copy] as const;
}
