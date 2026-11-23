"use client";

import { useRouter } from "next/navigation";
import { crm } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/sales/DocumentEditor";
import type { SalesDoc } from "@/components/sales/types";

export default function NewInvoicePage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New invoice" subtitle="Prices are entered in dollars; totals are calculated for you." />
      <DocumentEditor
        kind="invoice"
        submitLabel="Create invoice"
        onSubmit={async (body) => {
          const doc = await crm<SalesDoc>("/app/invoices", { method: "POST", body });
          router.push(`/app/invoices/${doc.id}`);
        }}
      />
    </div>
  );
}
