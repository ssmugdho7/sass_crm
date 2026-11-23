<?php

namespace App\Domains\Sales\Actions;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Next sequential number per tenant, e.g. EST-0001 / INV-0001.
 * Allocated from a per-tenant counter row (document_sequences) under a row lock. Call it inside the same
 * DB::transaction that inserts the document so the lock is held until the insert commits.
 */
class NextDocumentNumber
{
    /** @param class-string<Model> $model */
    public function __invoke(string $model, string $prefix, int $tenantId): string
    {
        return DB::transaction(function () use ($model, $prefix, $tenantId) {
            $row = $this->lockRow($tenantId, $prefix);
            if (! $row) {
                // First use: seed the counter from the highest existing number (idempotent if two requests race).
                $max = $model::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)
                    ->where('number', 'like', $prefix.'-%')->pluck('number')
                    ->map(fn ($n) => (int) substr($n, strlen($prefix) + 1))->max() ?? 0;
                DB::table('document_sequences')->insertOrIgnore([
                    'tenant_id' => $tenantId, 'type' => $prefix, 'next_value' => $max + 1, 'created_at' => now(), 'updated_at' => now(),
                ]);
                $row = $this->lockRow($tenantId, $prefix);
            }
            $value = (int) $row->next_value;
            DB::table('document_sequences')->where('id', $row->id)->update(['next_value' => $value + 1, 'updated_at' => now()]);

            return sprintf('%s-%04d', $prefix, $value);
        });
    }

    private function lockRow(int $tenantId, string $prefix): ?object
    {
        return DB::table('document_sequences')->where('tenant_id', $tenantId)->where('type', $prefix)->lockForUpdate()->first();
    }
}
