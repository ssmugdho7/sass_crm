import Link from "next/link";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { Pricing, Check } from "@/components/marketing/Pricing";

const pipeline = [
  { step: "Lead", text: "Enquiries from your website, calls and referrals land in one inbox." },
  { step: "Estimate", text: "Line-item quotes your client can approve in minutes." },
  { step: "Job", text: "Approved work becomes a job with site address, stage and budget." },
  { step: "Invoice", text: "Bill progress or final payments and see what’s outstanding." },
];

const features = [
  { title: "Leads & customers", text: "Capture enquiries, qualify them and keep every client contact and site in one place.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" },
  { title: "Projects & jobs", text: "Track every job from site visit to handover with stages, budgets and notes.", icon: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" },
  { title: "Crew tasks", text: "Assign work to your field crew, set due dates and see what’s done on site.", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" },
  { title: "Estimates", text: "Professional line-item quotes that convert to invoices in one click.", icon: "M9 7h6M9 11h6M9 15h4M6 3h12v18H6z" },
  { title: "Invoices & payments", text: "Send invoices, record payments and stop chasing money you’re owed.", icon: "M3 7h18v10H3zM3 11h18M7 15h3" },
  { title: "Team & roles", text: "Invite office staff and crew with permissions that match their job.", icon: "M17 20h5v-2a4 4 0 00-5-3.9M9 20H2v-2a4 4 0 017-2.7M12 7a3 3 0 11-6 0 3 3 0 016 0zm8 2a2 2 0 11-4 0 2 2 0 014 0z" },
];

const addons = [
  { name: "Online payments", text: "Clients pay invoices by card through Stripe." },
  { name: "Google Calendar", text: "Sync site visits and appointments to your calendar." },
  { name: "Appointments", text: "Let customers book consultations from your website." },
  { name: "Subcontractors", text: "Manage trades, insurance expiry and job assignments." },
  { name: "Timesheets", text: "Log crew hours against every job." },
  { name: "Job expenses", text: "Track material and labour costs to see real job profit." },
];

const faqs = [
  { q: "How does the free trial work?", a: "You get full access to your chosen plan for 14 days. No credit card is required to start, and you can pick a plan when the trial ends." },
  { q: "Do I get a website?", a: "Yes. Every account includes a public company website. Add your services, projects and photos in the CRM and the site updates itself — enquiries from it arrive as leads." },
  { q: "What are add-ons?", a: "Optional modules such as online payments, appointments, subcontractors, timesheets and job expenses. Install them from your dashboard when you need them; some plans include them for free." },
  { q: "Can my field crew use it?", a: "Yes. Invite crew members with limited permissions so they only see the jobs and tasks assigned to them." },
  { q: "Can I change plans later?", a: "Anytime. Upgrade or downgrade as your team grows — your data stays exactly where it is." },
  { q: "Is my data secure?", a: "Each company’s data is fully isolated, access is controlled by roles, and payment credentials are stored encrypted." },
];

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// Re-render at most every 5 minutes so plan prices (fetched server-side) stay fresh, and recover if the API was down at build.
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-600)_0%,transparent_55%)] opacity-40" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-white/15">
                For contractors, builders, remodelers & roofers
              </p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Win more jobs. <span className="text-brand-500">Get paid faster.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                BuildCRM runs your construction business from first enquiry to final invoice — leads, estimates, jobs, crew tasks, payments and your own company website, all in one place.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/register" className="rounded-lg bg-brand-700 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-900/30 hover:bg-brand-900">
                  Start 14-day free trial
                </Link>
                <Link href="/login" className="rounded-lg px-6 py-3 text-base font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-300">No credit card required · Set up in 5 minutes</p>
            </div>

            {/* Product mock */}
            <div aria-hidden className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
              <div className="rounded-xl bg-white p-5 text-slate-900 shadow-2xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Job pipeline</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">$184,250 in progress</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  {[
                    ["New leads", ["Kitchen remodel", "Roof repair"]],
                    ["Estimating", ["Deck & patio", "Basement fit-out"]],
                    ["On site", ["Two-storey extension"]],
                  ].map(([col, cards]) => (
                    <div key={col as string} className="rounded-lg bg-slate-50 p-2">
                      <p className="mb-2 font-medium text-slate-500">{col as string}</p>
                      {(cards as string[]).map((c) => (
                        <div key={c} className="mb-2 rounded-md bg-white p-2 shadow-sm ring-1 ring-slate-200">
                          <p className="font-medium">{c}</p>
                          <div className="mt-1 h-1.5 w-2/3 rounded bg-brand-200" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[["Estimates sent", "12"], ["Invoices due", "$23.4k"], ["Tasks today", "8"]].map(([l, v]) => (
                    <div key={l} className="rounded-lg p-3 ring-1 ring-slate-200">
                      <p className="text-[11px] text-slate-500">{l}</p>
                      <p className="text-lg font-bold">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem / pipeline */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Stop running your business from sticky notes and spreadsheets</h2>
            <p className="mt-4 text-lg text-slate-600">
              Missed callbacks, lost quotes and late invoices cost you jobs. BuildCRM connects every step so nothing slips through the cracks.
            </p>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-4">
            {pipeline.map((p, i) => (
              <li key={p.step} className="relative rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{p.step}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits */}
        <section className="bg-slate-50 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-3">
            {[
              { t: "Keep field crews in sync", d: "Assign tasks per job so everyone on site knows what’s next — and the office sees progress without phone tag." },
              { t: "Get paid online", d: "Send invoices with a pay-by-card link. Payments are recorded against the invoice automatically." },
              { t: "A website that builds itself", d: "Your services, projects and reviews in the CRM become your public company website. New enquiries arrive as leads." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">{b.t}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{b.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Core CRM</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Everything you need, included on every plan</h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl p-6 ring-1 ring-slate-200 transition hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon d={f.icon} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.text}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-brand-700 p-6 text-white sm:col-span-2 lg:col-span-3">
              <h3 className="font-semibold">Plus your own service website</h3>
              <p className="mt-2 text-sm leading-6 text-brand-50">
                Every account gets a public website for your company. Add services and completed projects in the dashboard and it grows with your business.
              </p>
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section id="addons" className="scroll-mt-20 bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">Add-on marketplace</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Install more power in one click</h2>
              <p className="mt-4 text-slate-300">Start lean and add capabilities as you grow. Higher plans include popular add-ons for free.</p>
            </div>
            <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {addons.map((a) => (
                <li key={a.name} className="flex gap-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <Check />
                  <div>
                    <h3 className="font-semibold">{a.name}</h3>
                    <p className="mt-1 text-sm text-slate-300">{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Simple pricing for every crew size</h2>
              <p className="mt-4 text-slate-600">Try any plan free for 14 days.</p>
            </div>
            <Pricing />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Frequently asked questions</h2>
          <div className="mt-10 divide-y divide-slate-200 rounded-2xl ring-1 ring-slate-200">
            {faqs.map((f) => (
              <details key={f.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                  {f.q}
                  <span aria-hidden className="text-brand-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand-700">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-white">Ready to run a tighter ship?</h2>
            <p className="text-brand-50">Set up your company in minutes. Your first 14 days are on us.</p>
            <Link href="/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow hover:bg-brand-50">
              Start 14-day free trial
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
