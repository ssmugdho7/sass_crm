# BuildCRM API

Laravel 13 API for tenant CRM accounts, platform administration, plans/add-ons, sales documents, operations, and public company websites. See the repository AGENTS.md and CLAUDE.md for application conventions.

## Local development

Run `./pandacode-run.sh` from the repository root. It runs pending migrations, synchronizes the module catalog, and starts the API on 8010, Next.js on 3010, the queue worker, and Laravel's scheduler. It stops for migration/catalog errors. Keep existing local data; use `php artisan migrate`, not a database reset, when updating an existing installation.

Checks from this directory: `php artisan test` and `./vendor/bin/pint --dirty --format agent`. The normal suite uses isolated in-memory SQLite. `Sales/DatabaseLockingTest` additionally runs simultaneous independent clients when the test connection is MySQL, its database name ends in `_test`, and PHP pcntl is available. That test rebuilds its dedicated test database; never point tests at application data.

## Billing and integrations

SaaS subscription collection is manual: paid plan upgrades and billing-cycle changes create a pending request, then a platform admin confirms payment and approves it. Eligible downgrades apply immediately. Paid add-ons outside the plan remain pending until the admin enables them from the account's Modules tab; pending requests appear in the platform overview and account filter. Included or free add-ons do not need paid approval. Stripe Checkout is for the tenant's customer invoices, not platform subscription billing.

Google Calendar uses tenant-specific OAuth client credentials; enable Calendar API and register the callback `${APP_URL}/api/public/google/callback` in Google Cloud. Stripe needs the tenant's keys and a signing secret for the webhook URL shown in its add-on settings. Use test-mode credentials first. Neither live integration has been connected or verified by this review.

## Deployment status and requirements

**Deployment is pending at the user's request until Bluehost supports Node.js.** `buildcrm.justsmartchoice.com` exists in cPanel and resolves to Bluehost. No BuildCRM application or customer database has been deployed there. Existing client sites are separate.

The account has PHP 8.5 available at `/opt/cpanel/ea-php85/root/usr/bin/php`, SSH and cron, but the inspected server has no installed Node.js/Passenger runtime. Keep the Next.js frontend; static export or a jQuery rewrite is not part of the approved plan. The current production database and web-process routing still need validation when deployment resumes.

The payment-reference migration cannot restore the old uniqueness constraint if valid duplicate manual references have since been recorded. A rollback may stop safely; never delete financial data to force it through.

For an eventual fresh production installation:

- Keep source, `.env`, storage and database files outside public document roots. Serve Laravel only through its `public` directory.
- Install production Composer dependencies with the selected PHP binary (`composer install --no-dev --optimize-autoloader`), configure a private `.env`, generate APP_KEY once, and retain that key across releases because tenant integration secrets are encrypted with it.
- Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` to the actual public API origin, and `APP_FRONTEND_URL` to the frontend origin. Configure the production database and mail transport; never use seeded demo/admin passwords for public access.
- Run `php artisan migrate --force`, `php artisan modules:sync`, and `php artisan storage:link`. Keep storage and bootstrap/cache writable. Do not seed production with demo data.
- Run a supported queue supervisor. For limited hosting, a non-overlapping cron-driven `queue:work --stop-when-empty` can be evaluated instead of assuming persistent processes survive.
- Install Laravel's minute scheduler cron with the real application path and selected PHP binary: `* * * * * cd /path/to/apps/api && /opt/cpanel/ea-php85/root/usr/bin/php artisan schedule:run >> /dev/null 2>&1`. It drives hourly subscription enforcement. Do not install it until the production application/configuration exists.
- Build and run Next.js with the actual API_URL; verify HTTPS, `/api` routing, uploads, login, tenant isolation, queue processing, scheduler, Stripe test webhook and Google OAuth before declaring production ready.

---

<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
