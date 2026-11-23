<?php

namespace App\Domains\Account\Actions;

use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

/**
 * Self-service plan change. Payment collection is not implemented, so this fails closed:
 * - Paid-up ('active') tenants switch plan/cycle immediately via ApplyPlan; status and current_period_end are untouched.
 * - Any other status only records the request; the BuildCRM team approves it after payment (platform portal).
 */
class ChangePlan
{
    public function __construct(private ApplyPlan $apply) {}

    /** @return 'changed'|'requested' */
    public function __invoke(Tenant $tenant, Plan $plan, string $cycle): string
    {
        return DB::transaction(function () use ($tenant, $plan, $cycle) {
            $locked = Tenant::whereKey($tenant->id)->lockForUpdate()->firstOrFail();
            ApplyPlan::ensureSeatsFit($locked, $plan);

            if ($locked->status !== 'active') {
                $locked->update(['requested_plan_id' => $plan->id, 'requested_cycle' => $cycle, 'plan_requested_at' => now()]);

                return 'requested';
            }

            ($this->apply)($locked, $plan, $cycle);

            return 'changed';
        });
    }
}
