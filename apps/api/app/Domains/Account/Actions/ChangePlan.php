<?php

namespace App\Domains\Account\Actions;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Self-service plan change. Payment collection is not implemented, so this fails closed:
 * - Paid-up ('active') tenants switch plan/cycle immediately; status and current_period_end are untouched.
 * - Any other status only records the request; the BuildCRM team activates it after payment (platform portal).
 */
class ChangePlan
{
    /** @return 'changed'|'requested' */
    public function __invoke(Tenant $tenant, Plan $plan, string $cycle): string
    {
        return DB::transaction(function () use ($tenant, $plan, $cycle) {
            $tenant = Tenant::whereKey($tenant->id)->lockForUpdate()->firstOrFail();
            $this->ensureSeatsFit($tenant, $plan);

            if ($tenant->status !== 'active') {
                $tenant->update(['requested_plan_id' => $plan->id, 'requested_cycle' => $cycle, 'plan_requested_at' => now()]);

                return 'requested';
            }

            $this->syncEntitlements($tenant, $tenant->plan, $plan);
            $tenant->update([
                'plan_id' => $plan->id, 'billing_cycle' => $cycle,
                'requested_plan_id' => null, 'requested_cycle' => null, 'plan_requested_at' => null,
            ]);

            return 'changed';
        });
    }

    private function ensureSeatsFit(Tenant $tenant, Plan $plan): void
    {
        if ($plan->max_users === null) {
            return;
        }
        $active = User::where('tenant_id', $tenant->id)->where('status', 'active')->count();
        if ($active > $plan->max_users) {
            throw ValidationException::withMessages(['plan' => "The {$plan->name} plan allows {$plan->max_users} active users, but you have {$active}. Disable some users before switching."]);
        }
    }

    /** Enable the new plan's modules; disable modules only the old plan provided (separately installed add-ons stay). */
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
