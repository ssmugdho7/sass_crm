<?php

namespace App\Support\Tenancy;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/** Validation helpers for tenant routes. Use for every referenced id: TenantRules::exists('customers'). */
class TenantRules
{
    public static function exists(string $table, string $column = 'id'): Exists
    {
        return Rule::exists($table, $column)->where('tenant_id', CurrentTenant::id());
    }
}
