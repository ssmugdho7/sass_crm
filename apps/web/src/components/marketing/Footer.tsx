import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo dark />
          <p className="mt-4 max-w-sm text-sm leading-6">
            The CRM built for contractors, builders, remodelers and roofers — from the first enquiry to the final invoice.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Product</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/#features" className="hover:text-white">Features</Link></li>
            <li><Link href="/#addons" className="hover:text-white">Add-ons</Link></li>
            <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link href="/#faq" className="hover:text-white">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Account</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/register" className="hover:text-white">Start free trial</Link></li>
            <li><Link href="/login" className="hover:text-white">Log in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs sm:px-6">© {new Date().getFullYear()} BuildCRM. All rights reserved.</p>
      </div>
    </footer>
  );
}
