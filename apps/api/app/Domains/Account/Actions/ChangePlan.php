<?php

namespace App\Domains\Account\Actions;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantModule;
use Illuminate\Support\Facades\DB;

/**
 * Switches a tenant's subscription plan. This is the single hook where real SaaS payment
 * collection (e.g. creating/updating a Stripe subscription) would be performed before activation.
 */
class ChangePlan
{
    public function __invoke(Tenant $tenant, Plan $plan, string $cycle): Tenant
    {
        return DB::transaction(function () use ($tenant, $plan, $cycle) {
            foreach ($plan->included_modules ?? [] as $key) {
                TenantModule::withoutGlobalScope('tenant')->updateOrCreate(
                    ['tenant_id' => $tenant->id, 'module_key' => $key],
                    ['status' => 'active'],
                );
            }
            $tenant->update([
                'plan_id' => $plan->id,
                'billing_cycle' => $cycle,
                'status' => 'active',
                'current_period_end' => $cycle === 'yearly' ? now()->addYear() : now()->addMonth(),
            ]);

            return $tenant->refresh()->load('plan');
        });
    }
}
