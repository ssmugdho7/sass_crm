"use client";

import Link from "next/link";
import { useState } from "react";
import { money } from "@/lib/api";
import { ErrorText } from "@/components/ui";
import { useCatalog, type PublicAddon } from "./plans";

const featured = "growth";

/** Plan cards with monthly/yearly toggle, plus the add-on price list. */
export function Pricing({ showAddons = false }: { showAddons?: boolean }) {
  const { catalog, error } = useCatalog();
  const [yearly, setYearly] = useState(false);
  const addonName = (key: string) => catalog?.addons.find((a) => a.key === key)?.name ?? key;

  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full bg-slate-100 p-1 text-sm font-medium">
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              role="radio"
              aria-checked={yearly === y}
              onClick={() => setYearly(y)}
              className={`rounded-full px-5 py-2 transition ${yearly === y ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {y ? (
                <>
                  Yearly <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">2 months free</span>
                </>
              ) : (
                "Monthly"
              )}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mx-auto mt-10 max-w-md">
          <ErrorText error="Pricing could not be loaded. Please refresh the page." />
        </div>
      ) : !catalog ? (
        <div className="mt-10 grid gap-6 md:grid-cols-3" aria-busy="true" aria-label="Loading plans">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {catalog.plans.map((p) => {
            const hot = p.slug === featured;
            const price = yearly ? p.price_yearly : p.price_monthly;
            return (
              <article
                key={p.id}
                className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ${hot ? "ring-2 ring-brand-500 shadow-lg" : "ring-slate-200"}`}
              >
                {hot && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Up to {p.max_users} users</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{money(price)}</span>
                  <span className="text-sm text-slate-500">/{yearly ? "year" : "month"}</span>
                </p>
                {yearly && p.price_monthly > 0 && (
                  <p className="mt-1 text-xs text-emerald-700">Save {money(p.price_monthly * 12 - p.price_yearly)} a year</p>
                )}
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {(p.features ?? []).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check /> {f}
                    </li>
                  ))}
                  {(p.included_modules ?? []).length > 0 && (
                    <li className="pt-2 text-xs text-slate-500">
                      Includes add-ons: {(p.included_modules ?? []).map(addonName).join(", ")}
                    </li>
                  )}
                </ul>
                <Link
                  href={`/register?plan=${p.slug}`}
                  className={`mt-8 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${hot ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                >
                  Start 14-day free trial
                </Link>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">No credit card required. Cancel anytime.</p>

      {showAddons && catalog && catalog.addons.length > 0 && <AddonPrices addons={catalog.addons} />}
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

export function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}
