"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { can, crm, hasModule } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, ErrorText, Link, PageHeader, Spinner } from "@/components/ui";
import { DocumentEditor } from "@/components/sales/DocumentEditor";
import { StatusBadge } from "@/components/sales/StatusBadge";
import { useCopyLink } from "@/components/sales/useCopy";
import type { SalesDoc } from "@/components/sales/types";

export default function EstimatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const [doc, setDoc] = useState<SalesDoc | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, copy] = useCopyLink();
  const manage = can(me, "estimates.manage");

  const load = useCallback(() => crm<SalesDoc>(`/app/estimates/${id}`).then(setDoc).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const setStatus = (status: string) => run(async () => setDoc(await crm<SalesDoc>(`/app/estimates/${id}/status`, { method: "POST", body: { status } })));
  const convert = () => run(async () => {
    const inv = await crm<SalesDoc>(`/app/estimates/${id}/convert`, { method: "POST" });
    router.push(`/app/invoices/${inv.id}`);
  });
  const remove = () => {
    if (!window.confirm("Delete this estimate?")) return;
    run(async () => { await crm(`/app/estimates/${id}`, { method: "DELETE" }); router.push("/app/estimates"); });
  };

  if (!doc) return error ? <ErrorText error={error} /> : <Spinner />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Estimate ${doc.number}`}
        subtitle={doc.customer?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => copy(`/i/estimate/${doc.public_token}`)}>{copied ? "Link copied!" : "Copy client link"}</Button>
            <a href={`/i/estimate/${doc.public_token}`} target="_blank" rel="noreferrer"><Button variant="ghost">Preview</Button></a>
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={doc.status} />
        {manage && (
          <>
            {doc.status === "draft" && <Button variant="secondary" disabled={busy} onClick={() => setStatus("sent")}>Mark as sent</Button>}
            {["draft", "sent", "declined"].includes(doc.status) && <Button variant="secondary" disabled={busy} onClick={() => setStatus("accepted")}>Mark accepted</Button>}
            {["draft", "sent", "accepted"].includes(doc.status) && <Button variant="secondary" disabled={busy} onClick={() => setStatus("declined")}>Mark declined</Button>}
            {doc.status !== "draft" && <Button variant="ghost" disabled={busy} onClick={() => setStatus("draft")}>Back to draft</Button>}
            {doc.invoice_id ? (
              <Link href={`/app/invoices/${doc.invoice_id}`}><Button variant="secondary">View invoice</Button></Link>
            ) : (
              hasModule(me, "invoices") && can(me, "invoices.manage") && doc.status !== "declined" && (
                <Button disabled={busy} onClick={convert}>Convert to invoice</Button>
              )
            )}
            <Button variant="danger-ghost" className="ml-auto" disabled={busy} onClick={remove}>Delete</Button>
          </>
        )}
      </div>
      <div className="mb-4 space-y-2">
        <ErrorText error={error} />
        {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Estimate saved.</p>}
      </div>
      <DocumentEditor
        key={version}
        kind="estimate"
        initial={doc}
        disabled={!manage}
        submitLabel="Save changes"
        onSubmit={async (body) => {
          setDoc(await crm<SalesDoc>(`/app/estimates/${id}`, { method: "PUT", body }));
          setVersion((v) => v + 1);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
      />
    </div>
  );
}
