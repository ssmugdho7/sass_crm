<?php

namespace App\Domains\Account\Actions;

use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

/**
 * Self-service plan change. Payment collection is not implemented, so this fails closed:
 * - Active tenants can downgrade immediately without changing the current billing period.
 * - Upgrades, cycle changes and any other status only record the request; the BuildCRM team approves it after payment (platform portal).
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

            if (self::requiresApproval($locked, $plan, $cycle)) {
                $locked->update(['requested_plan_id' => $plan->id, 'requested_cycle' => $cycle, 'plan_requested_at' => now()]);

                return 'requested';
            }

            ($this->apply)($locked, $plan, $cycle);

            return 'changed';
        });
    }

    /** New cost, seats, modules or billing terms require platform confirmation before granting access. */
    public static function requiresApproval(Tenant $tenant, Plan $plan, string $cycle): bool
    {
        $current = $tenant->plan;
        if ($tenant->status !== 'active' || ! $current || $cycle !== $tenant->billing_cycle) {
            return true;
        }
        $price = $cycle === 'yearly' ? 'price_yearly' : 'price_monthly';

        return $plan->{$price} > $current->{$price}
            || ($current->max_users !== null && ($plan->max_users === null || $plan->max_users > $current->max_users))
            || array_diff($plan->included_modules ?? [], $current->included_modules ?? []) !== [];
    }
}
