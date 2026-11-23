"use client";

import Link from "next/link";
import { useState } from "react";
import { money } from "@/lib/api";
import type { PublicPlan } from "./catalog";

const featured = "growth";

/** Plan cards with the monthly/yearly toggle. Plans come from the server so prices are in the initial HTML. */
export function PlanCards({ plans, addonNames }: { plans: PublicPlan[]; addonNames: Record<string, string> }) {
  const [yearly, setYearly] = useState(false);

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

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
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
                    Includes add-ons: {(p.included_modules ?? []).map((k) => addonNames[k] ?? k).join(", ")}
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
