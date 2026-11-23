"use client";

import { Badge } from "@/components/ui";

const tone: Record<string, string> = {
  draft: "gray", sent: "blue", accepted: "green", declined: "red",
  partial: "amber", paid: "green", overdue: "red", void: "gray",
};

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const s = overdue && !["paid", "void"].includes(status) ? "overdue" : status;
  return <Badge tone={tone[s] ?? "gray"}>{s.replace("_", " ")}</Badge>;
}
