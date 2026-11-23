# BuildCRM — SaaS CRM for construction businesses

Subscription SaaS modeled on ShopLagbe (`/Volumes/mySSD/projects/ecommerce`): marketing home → plans → sign-up creates a tenant (a "CRM account") with an Owner user, a minimal core CRM, installable add-ons, and a public service website per tenant that grows from content added in the dashboard. A super admin portal manages all accounts.

## Stack
- `apps/api` — Laravel 13 / PHP 8.5, Sanctum bearer tokens, SQLite locally (`database/database.sqlite`). `php artisan serve` → :8000.
- `apps/web` — Next.js 16 App Router + Tailwind v4, React 19. `npm run dev` → :3000; `/api/*` is rewritten to the API (`API_URL`). Read `apps/web/AGENTS.md`: this Next.js has breaking changes; check `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Run both: `./pandacode-run.sh`.

## Commands
- API: `php artisan migrate:fresh --seed`, `php artisan test`, `./vendor/bin/pint` (format before finishing).
- Web: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Seeded logins (password `password`): super admin `admin@sasscrm.test` at `/admin/login`; CRM owner `owner@demo.test` at `/login`.

## Backend rules
- Domain modules live in `app/Domains/{Name}/` with their own `routes.php` (auto-loaded by `routes/api.php` under `/api`), `Http/` controllers, `Actions/`, `Models/` for domain-only models.
- Domain migrations go in `app/Domains/{Name}/Database/Migrations/` (auto-loaded). Demo data: `app/Domains/{Name}/Database/DemoSeeder.php` (idempotent, scoped to tenant slug `demo-builders`); the architect wires it into DatabaseSeeder.
- Shared models in `app/Models`: Tenant, User, Role, Plan, Module, TenantModule, Customer, Lead, Project, Task, Estimate, Invoice, Payment. Do not change shared migrations; add new migrations for new tables/columns.
- Multi-tenancy: every tenant-owned table has `tenant_id`; its model uses `App\Support\Tenancy\BelongsToTenant` (global scope `tenant` + auto-stamp). Never bypass the scope in tenant routes. Platform/super-admin and public code use `withoutGlobalScope('tenant')` explicitly and filter by tenant themselves.
- Route groups:
  - Tenant CRM: `Route::middleware(['auth:sanctum', 'tenant'])->prefix('app')`, plus `module:{key}` (tenant has module) and `perm:{x.y}` (user permission). Permissions are listed per module in `config/crm_modules.php`; `*.view` for reads, `*.manage` for writes.
  - Super admin: `Route::middleware(['auth:sanctum', 'super'])->prefix('platform')`.
  - Public (no auth, throttle writes): `Route::prefix('public')`.
- Module catalog = `config/crm_modules.php` (seeded into `modules`). Core modules are always on; add-ons are rows in `tenant_modules` (`status`, encrypted `config`). `Tenant::hasModule($key)`.
- Money is integer cents everywhere. Recording an invoice payment goes only through `App\Domains\Sales\Actions\RecordPayment`.
- Controllers stay thin: validate → model/Action → JSON. Return plain arrays/models or `->paginate(25)`.
- Tests: `tests/Feature/{Domain}/`, `RefreshDatabase` + `$seed = true`. Login helper: POST `/api/auth/login` and use the token, or `Sanctum::actingAs($user)`.

## Frontend rules
- `src/lib/api.ts`: `crm()` / `platform()` fetch helpers (bearer token per realm), `ApiError`, `can(me, perm)`, `hasModule(me, key)`, `money(cents)`.
- `src/lib/session.tsx`: `useSession()` → `{ me, refresh, logout }` inside `/app` (realm crm) and `/admin` (realm platform). Call `refresh()` after changing modules/roles.
- `src/components/ui`: Button, Field, Input, Textarea, Select, Card, PageHeader, Badge, Table, Modal, Stat, ErrorText, fieldError, Spinner. Use them; brand color is `brand-*` (orange) on slate.
- `src/lib/nav.ts`: CRM sidebar entries (route, module, permission) and admin nav. Pages must exist at those routes.
- Pages under `/app` and `/admin` are client components (`"use client"`).
- Public tenant website: `/site/[slug]`.


## Verified local adoption (2026-11-24)
- PandaCode is actively developing this checkout; preserve its uncommitted work and coordinate before editing the same application files.
- The launcher and Next.js proxy use frontend `http://127.0.0.1:3010` and API `http://127.0.0.1:8010`; these override the generic ports above. `./pandacode-run.sh` also starts the database queue worker, runs pending migrations, syncs modules, and creates the storage link.
- Observed CLI: PHP 8.4.23, Composer 2.10.2, Node 22.23.0. Web manifest: Next.js 16.4.6, React 19.3.0, Tailwind 4.3.3. Composer requires PHP ^8.3 and Laravel ^13.17; the documented PHP 8.5 is not the current CLI.
- Backend domains: Identity, Marketing, Account, Crm, Sales, Operations, Website, Integrations, Platform. Domain providers and migrations are discovered automatically.
- ShopLagbe is a reference, not a shared runtime: this app uses SQLite locally, tenant_id, database roles, integer cents, separate CRM/platform tokens, and orange/slate UI. Do not copy ShopLagbe's store_id, decimal money, config-only roles, or production setup into BuildCRM.
- Stripe collects a tenant's customer invoice payments. Google Calendar connects per tenant. Credentials live in encrypted add-on configuration; neither integration was connected or verified against external services during adoption. SaaS plan activation is a separate platform approval flow.
- `subscriptions:enforce` is scheduled hourly in routes/console.php. The development launcher starts a queue worker but no scheduler; hosting must run Laravel's scheduler for automatic lifecycle enforcement.
- Browser baseline: marketing page and seeded owner login/dashboard loaded successfully with demo data. Initial API run had two failures while PandaCode was editing tests; the subsequent full run passed 136 tests / 991 assertions. TypeScript and ESLint passed. This is local evidence, not a full audit or deployment verification.
- Existing CLAUDE.md contains additional conventions; consult it alongside this file until the active author reconciles the two. Do not overwrite it during concurrent work.


## Post-round-five verification (2026-11-24)
- Review branch: `codex/post-round-five-review`, based on the completed round-four fixes that round five reviewed. PandaCode's later Blade/jQuery conversion is separate; do not overwrite either workstream while the frontend choice is pending.
- The user's deployment instruction is to keep deployment pending until Bluehost provides Node support. `buildcrm.justsmartchoice.com` has been created; no app deployment was performed by this review.
- Paid upgrades, additional seats/entitlements and billing-cycle changes need platform approval. Paid add-ons outside the plan use `tenant_modules.status=pending` until a platform admin confirms payment and enables them. Eligible downgrades, included add-ons and free add-ons still work directly.
- The launcher now starts `schedule:work`, correcting the earlier local scheduler gap. Production still needs Laravel's minute cron and a supported queue runtime; see apps/api/README.md.
- Current verification: 160 tests passed on an isolated MySQL instance, including real concurrent payment and first-number allocation clients. Default SQLite: 159 passed, 1 MySQL-only test skipped. TypeScript, lint, production build, Pint and secret scans passed. This does not verify live Stripe/Google or the eventual Bluehost production database.
- Boost was installed as required by apps/api/AGENTS.md. Current review shell observed PHP 8.5.12 / Composer 2.11.1 / Laravel 13.43.0; the earlier adoption runtime observation was shell-dependent.
