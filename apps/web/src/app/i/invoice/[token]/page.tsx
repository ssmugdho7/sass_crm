"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";
import { PublicDocument } from "@/components/sales/PublicDocument";

function View() {
  const { token } = useParams<{ token: string }>();
  const paid = useSearchParams().get("paid") === "1";
  return <PublicDocument kind="invoice" token={token} paid={paid} />;
}

export default function PublicInvoicePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <View />
    </Suspense>
  );
}
