<?php

namespace App\Domains\Integrations\Services;

use App\Models\Tenant;
use App\Models\TenantModule;
use Illuminate\Support\Str;

/** Per-tenant random key in the Stripe webhook URL, so the URL survives slug changes and can't be guessed. */
class StripeWebhookKey
{
    public const MODULE = 'payment_gateway';

    /** Returns the tenant's webhook key, generating and storing it on first need. */
    public static function ensure(Tenant $tenant): string
    {
        $row = TenantModule::withoutGlobalScope('tenant')->firstOrNew(
            ['tenant_id' => $tenant->id, 'module_key' => self::MODULE],
            ['status' => 'disabled'],
        );
        $config = (array) ($row->config ?? []);
        $key = (string) ($row->webhook_key ?: ($config['webhook_key'] ?? '') ?: Str::random(40));
        if (! $row->exists || $row->webhook_key !== $key || ($config['webhook_key'] ?? null) !== $key) {
            $config['webhook_key'] = $key;
            $row->config = $config;
            $row->webhook_key = $key;
            $row->save();
        }

        return $key;
    }

    /** Finds the tenant owning a webhook key (null for unknown keys). */
    public static function tenant(string $key): ?Tenant
    {
        if (strlen($key) < 32) {
            return null;
        }
        $row = TenantModule::withoutGlobalScope('tenant')
            ->where('module_key', self::MODULE)->where('webhook_key', $key)->first();
        if (! $row || ! hash_equals((string) (((array) ($row->config ?? []))['webhook_key'] ?? ''), $key)) {
            return null;
        }

        return Tenant::find($row->tenant_id);
    }

    /** Absolute webhook URL on the API's public origin (APP_URL), never the requesting/dev frontend origin. */
    public static function url(string $key): string
    {
        return rtrim((string) config('app.url'), '/').'/api/public/stripe/webhook/'.$key;
    }
}
