<?php

namespace App\Domains\Operations\Support;

use App\Support\Tenancy\CurrentTenant;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/** Validation helpers: referenced ids must belong to the current tenant. */
class TenantRules
{
    public static function exists(string $table): Exists
    {
        return Rule::exists($table, 'id')->where('tenant_id', CurrentTenant::id());
    }
}
