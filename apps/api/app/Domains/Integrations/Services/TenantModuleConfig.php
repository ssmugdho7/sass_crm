<?php

namespace App\Domains\Integrations\Services;

use App\Models\Tenant;
use App\Models\TenantModule;

/** Reads an add-on's per-tenant config outside of tenant context (public/webhook/listener code). */
class TenantModuleConfig
{
    /** Returns the config array if the tenant has the module enabled, otherwise null. */
    public static function for(Tenant $tenant, string $key): ?array
    {
        if (! $tenant->hasModule($key)) {
            return null;
        }
        $row = TenantModule::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenant->id)->where('module_key', $key)->first();

        return (array) ($row?->config ?? []);
    }

    public static function frontend(string $path = ''): string
    {
        return rtrim((string) config('services.frontend_url'), '/').$path;
    }
}
