"use client";

import { useRouter } from "next/navigation";
import { crm } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/sales/DocumentEditor";
import type { SalesDoc } from "@/components/sales/types";

export default function NewEstimatePage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New estimate" subtitle="Prices are entered in dollars; totals are calculated for you." />
      <DocumentEditor
        kind="estimate"
        submitLabel="Create estimate"
        onSubmit={async (body) => {
          const doc = await crm<SalesDoc>("/app/estimates", { method: "POST", body });
          router.push(`/app/estimates/${doc.id}`);
        }}
      />
    </div>
  );
}
