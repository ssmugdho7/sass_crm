<?php

namespace App\Domains\Account\Support;

use App\Models\Module;
use App\Models\Tenant;
use App\Models\TenantModule;

/** Add-on (non-core) catalog: config('crm_modules') merged with admin-controlled rows in `modules`. */
class AddonCatalog
{
    /** @return array<string, array{key:string,name:string,category:string,description:string,price_monthly:int,schema:array<string,string>,permissions:list<string>}> */
    public static function available(): array
    {
        $rows = Module::catalog();
        $out = [];
        foreach (config('crm_modules') as $key => $m) {
            if ($m['core']) {
                continue;
            }
            $row = $rows->get($key);
            if ($row && ! $row->is_active) {
                continue;
            }
            $out[$key] = [
                'key' => $key,
                'name' => $row->name ?? $m['name'],
                'category' => $m['category'],
                'description' => $row->description ?? $m['description'],
                'price_monthly' => (int) ($row->price_monthly ?? $m['price']),
                'schema' => $m['config'] ?? [],
                'permissions' => $m['permissions'] ?? [],
            ];
        }

        return $out;
    }

    public static function find(string $key): array
    {
        $addon = self::available()[$key] ?? null;
        abort_unless($addon, 404, 'Add-on not found.');

        return $addon;
    }

    /** Addon entry with this tenant's install state and masked config. */
    public static function present(array $addon, Tenant $tenant, ?TenantModule $installed): array
    {
        $config = $installed?->config ?? [];
        $fields = [];
        foreach ($addon['schema'] as $field => $type) {
            $value = $config[$field] ?? null;
            $fields[] = $type === 'secret'
                ? ['key' => $field, 'type' => 'secret', 'set' => filled($value), 'hint' => filled($value) ? '••••'.substr((string) $value, -4) : null]
                : ['key' => $field, 'type' => $type, 'value' => $value];
        }
        unset($addon['schema']);

        return $addon + [
            'installed' => $installed?->status === 'active',
            'included_in_plan' => in_array($addon['key'], $tenant->plan?->included_modules ?? [], true),
            'configurable' => $fields !== [],
            'fields' => $fields,
        ];
    }
}
