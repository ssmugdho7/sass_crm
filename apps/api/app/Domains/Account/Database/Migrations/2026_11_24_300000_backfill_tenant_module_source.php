<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Legacy tenant_modules rows have source null: mark them 'plan' when the tenant's plan includes the module, else 'addon'. */
return new class extends Migration
{
    public function up(): void
    {
        $plans = DB::table('plans')->pluck('included_modules', 'id')
            ->map(fn ($json) => is_string($json) ? (json_decode($json, true) ?: []) : []);
        $tenantPlans = DB::table('tenants')->pluck('plan_id', 'id');

        DB::table('tenant_modules')->whereNull('source')->orderBy('id')
            ->each(function ($row) use ($plans, $tenantPlans) {
                $included = $plans->get($tenantPlans->get($row->tenant_id)) ?? [];
                DB::table('tenant_modules')->where('id', $row->id)
                    ->update(['source' => in_array($row->module_key, $included, true) ? 'plan' : 'addon']);
            });
    }

    public function down(): void
    {
        // Irreversible data backfill; nothing to undo.
    }
};
