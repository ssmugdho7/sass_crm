import { Logo } from "./Logo";

/** Centered card layout for login / register. */
export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-md">
          <Logo />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      {aside && (
        <aside className="relative hidden w-[42%] flex-col justify-center overflow-hidden bg-slate-900 px-12 text-white lg:flex">
          <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
          <div className="relative">{aside}</div>
        </aside>
      )}
    </div>
  );
}
