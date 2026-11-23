<?php

namespace App\Domains\Sales\Actions;

use Illuminate\Database\Eloquent\Model;

/** Next sequential number per tenant, e.g. EST-0001 / INV-0001. */
class NextDocumentNumber
{
    /** @param class-string<Model> $model */
    public function __invoke(string $model, string $prefix, int $tenantId): string
    {
        $max = $model::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)
            ->where('number', 'like', $prefix.'-%')->pluck('number')
            ->map(fn ($n) => (int) substr($n, strlen($prefix) + 1))->max() ?? 0;

        return sprintf('%s-%04d', $prefix, $max + 1);
    }
}
