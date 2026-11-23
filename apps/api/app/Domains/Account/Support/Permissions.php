<?php

namespace App\Domains\Account\Support;

use App\Models\Tenant;

class Permissions
{
    /** Permission catalog grouped by module, limited to modules the tenant has enabled. */
    public static function grouped(Tenant $tenant): array
    {
        $enabled = $tenant->enabledModuleKeys();

        return collect(config('crm_modules'))
            ->filter(fn ($m, $key) => in_array($key, $enabled, true) && ! empty($m['permissions']))
            ->map(fn ($m, $key) => ['module' => $key, 'name' => $m['name'], 'permissions' => $m['permissions']])
            ->values()->all();
    }

    /** @return list<string> */
    public static function allowed(Tenant $tenant): array
    {
        return collect(self::grouped($tenant))->pluck('permissions')->flatten()->unique()->values()->all();
    }
}
