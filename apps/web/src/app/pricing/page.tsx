import type { Metadata } from "next";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { Pricing } from "@/components/marketing/Pricing";

export const metadata: Metadata = {
  title: "Pricing — BuildCRM",
  description: "Simple plans for construction businesses. 14-day free trial, no credit card required.",
};

// Re-render at most every 5 minutes so plan prices (fetched server-side) stay fresh, and recover if the API was down at build.
export const revalidate = 300;

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Pricing that grows with your crew</h1>
            <p className="mt-4 text-lg text-slate-600">Every plan includes the full core CRM and your own company website. Add more when you need it.</p>
          </div>
          <Pricing showAddons />
        </div>
      </main>
      <Footer />
    </>
  );
}
