import Link from "next/link";
import { money } from "@/lib/api";
import { fetchCatalog, type PublicAddon } from "./catalog";
import { Check, PlanCards } from "./PlanCards";

export { Check };

/**
 * Server component: plans are fetched on the server (cached ~5 min) so prices are in the HTML.
 * Only the monthly/yearly toggle (PlanCards) runs on the client.
 */
export async function Pricing({ showAddons = false }: { showAddons?: boolean }) {
  const catalog = await fetchCatalog();

  if (!catalog || catalog.plans.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
        <p className="font-semibold text-slate-900">Pricing is temporarily unavailable.</p>
        <p className="mt-2 text-sm text-slate-600">Every plan starts with a 14-day free trial — no credit card required.</p>
        <Link href="/register" className="mt-6 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Start your free trial
        </Link>
      </div>
    );
  }

  const addonNames = Object.fromEntries(catalog.addons.map((a) => [a.key, a.name]));
  return (
    <div>
      <PlanCards plans={catalog.plans} addonNames={addonNames} />
      <p className="mt-6 text-center text-sm text-slate-500">No credit card required. Cancel anytime.</p>
      {showAddons && catalog.addons.length > 0 && <AddonPrices addons={catalog.addons} />}
    </div>
  );
}

function AddonPrices({ addons }: { addons: PublicAddon[] }) {
  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <h3 className="text-center text-xl font-semibold text-slate-900">Add-ons — install only what you need</h3>
      <ul className="mt-6 divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
        {addons.map((a) => (
          <li key={a.key} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium text-slate-900">{a.name}</p>
              <p className="text-sm text-slate-500">{a.description}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-900">
              {money(a.price)}
              <span className="font-normal text-slate-500">/mo</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
