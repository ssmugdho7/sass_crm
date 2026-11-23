<?php

namespace App\Domains\Account\Actions;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Put a tenant on a plan + cycle: seat check against max_users, enable the plan's modules
 * (source 'plan'), disable modules only the old plan provided (separately installed add-ons stay),
 * then store plan_id/billing_cycle and clear any pending request. Status/period are the caller's job.
 * Used by self-service changes, platform tenant edits, and plan-request approval.
 */
class ApplyPlan
{
    public function __invoke(Tenant $tenant, Plan $plan, string $cycle): Tenant
    {
        return DB::transaction(function () use ($tenant, $plan, $cycle) {
            $locked = Tenant::whereKey($tenant->id)->lockForUpdate()->firstOrFail();
            self::ensureSeatsFit($locked, $plan);

            $this->syncEntitlements($locked, $locked->plan, $plan);
            $locked->update([
                'plan_id' => $plan->id, 'billing_cycle' => $cycle,
                'requested_plan_id' => null, 'requested_cycle' => null, 'plan_requested_at' => null,
            ]);
            $tenant->refresh()->forgetModules();

            return $locked;
        });
    }

    public static function ensureSeatsFit(Tenant $tenant, Plan $plan): void
    {
        if ($plan->max_users === null) {
            return;
        }
        $active = User::where('tenant_id', $tenant->id)->where('status', 'active')->count();
        if ($active > $plan->max_users) {
            throw ValidationException::withMessages(['plan' => "The {$plan->name} plan allows {$plan->max_users} active users, but the account has {$active}. Disable some users before switching."]);
        }
    }

    private function syncEntitlements(Tenant $tenant, ?Plan $old, Plan $new): void
    {
        $newKeys = $new->included_modules ?? [];
        $dropped = array_diff($old?->included_modules ?? [], $newKeys);
        if ($dropped !== []) {
            TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)
                ->whereIn('module_key', $dropped)->where('source', 'plan')
                ->update(['status' => 'disabled']);
        }
        foreach ($newKeys as $key) {
            $row = TenantModule::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id, 'module_key' => $key]);
            if ($row->exists && $row->status === 'active') {
                continue; // already on (keeps 'addon' origin if installed separately)
            }
            $row->fill(['status' => 'active', 'source' => 'plan'])->save();
        }
        $tenant->forgetModules();
    }
}
