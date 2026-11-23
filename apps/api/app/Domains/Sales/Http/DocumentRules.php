<?php

namespace App\Domains\Sales\Http;

use App\Support\Tenancy\CurrentTenant;
use Illuminate\Validation\Rule;

/** Validation shared by estimates and invoices. customer/project must belong to the current tenant. */
class DocumentRules
{
    public static function for(bool $creating, string $dateField): array
    {
        $req = $creating ? 'required' : 'sometimes';
        $tenant = CurrentTenant::id();

        return [
            'customer_id' => [$req, 'integer', Rule::exists('customers', 'id')->where('tenant_id', $tenant)],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->where('tenant_id', $tenant)],
            'issue_date' => ['sometimes', 'nullable', 'date'],
            $dateField => ['sometimes', 'nullable', 'date'],
            'items' => [$req, 'array', 'min:1', 'max:200'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.quantity' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'items.*.unit_price' => ['required', 'integer', 'min:0', 'max:100000000000'],
            'tax_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }
}
