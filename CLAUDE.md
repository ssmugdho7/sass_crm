# BuildCRM — SaaS CRM for construction businesses

Subscription SaaS modeled on ShopLagbe (`/Volumes/mySSD/projects/ecommerce`): marketing home → plans → sign-up creates a tenant (a "CRM account") with an Owner user, a minimal core CRM, installable add-ons, and a public service website per tenant that grows from content added in the dashboard. A super admin portal manages all accounts.

## Stack
- `apps/api` — Laravel 13 / PHP 8.5, Sanctum bearer tokens, SQLite locally (`database/database.sqlite`). `php artisan serve --port=8010` → :8010 (8000/3000 are used by ShopLagbe locally).
- `apps/web` — Next.js 16 App Router + Tailwind v4, React 19. `npm run dev -- --port 3010` → :3010; `/api/*` is rewritten to the API (`API_URL`). Read `apps/web/AGENTS.md`: this Next.js has breaking changes; check `node_modules/next/dist/docs/` before using unfamiliar APIs.
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
