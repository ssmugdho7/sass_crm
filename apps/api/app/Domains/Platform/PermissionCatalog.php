<?php

namespace App\Domains\Platform;

class PermissionCatalog
{
    /** @return list<array{key:string,name:string,core:bool,permissions:list<string>}> */
    public static function grouped(): array
    {
        return collect(config('crm_modules'))
            ->map(fn ($m, $key) => ['key' => $key, 'name' => $m['name'], 'core' => (bool) $m['core'], 'permissions' => array_values($m['permissions'] ?? [])])
            ->values()->all();
    }

    /** @return list<string> */
    public static function all(): array
    {
        return collect(config('crm_modules'))->pluck('permissions')->flatten()->unique()->values()->all();
    }

    /** @return list<string> */
    public static function addonKeys(): array
    {
        return collect(config('crm_modules'))->reject(fn ($m) => $m['core'])->keys()->all();
    }
}
