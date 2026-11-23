<?php

namespace App\Domains\Crm\Http;

use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/** Shared helpers for CRM controllers: tenant-scoped exists rules and page size. */
trait TenantRules
{
    protected function inTenant(string $table): Exists
    {
        return Rule::exists($table, 'id')->where('tenant_id', CurrentTenant::id());
    }

    protected function perPage(Request $request): int
    {
        return max(1, min(100, $request->integer('per_page', 25)));
    }
}
