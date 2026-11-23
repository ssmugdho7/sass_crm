<?php

namespace App\Domains\Account\Http;

use App\Domains\Account\Actions\ChangePlan;
use App\Domains\Account\Support\AddonCatalog;
use App\Models\Plan;
use App\Models\TenantModule;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class BillingController
{
    public function show()
    {
        $tenant = CurrentTenant::get()->load('plan');
        $included = $tenant->plan?->included_modules ?? [];
        $catalog = AddonCatalog::available();
        $paidAddons = TenantModule::where('status', 'active')->pluck('module_key')
            ->reject(fn ($k) => in_array($k, $included, true) || ! isset($catalog[$k]))
            ->map(fn ($k) => ['key' => $k, 'name' => $catalog[$k]['name'], 'price_monthly' => $catalog[$k]['price_monthly']])
            ->values();

        return [
            'plan' => $tenant->plan?->only(['id', 'name', 'slug', 'price_monthly', 'price_yearly', 'max_users', 'included_modules', 'features']),
            'status' => $tenant->status,
            'trial_ends_at' => $tenant->trial_ends_at,
            'current_period_end' => $tenant->current_period_end,
            'billing_cycle' => $tenant->billing_cycle,
            'can_self_change' => $tenant->status === 'active',
            'requested_plan' => $tenant->requested_plan_id
                ? Plan::find($tenant->requested_plan_id)?->only(['id', 'name', 'slug', 'price_monthly', 'price_yearly'])
                : null,
            'requested_cycle' => $tenant->requested_cycle,
            'plan_requested_at' => $tenant->plan_requested_at ? Carbon::parse($tenant->plan_requested_at)->toJSON() : null,
            'addons' => $paidAddons,
            'addon_monthly_cost' => $paidAddons->sum('price_monthly'),
            'plans' => Plan::where('is_active', true)->orderBy('sort')
                ->get(['id', 'name', 'slug', 'price_monthly', 'price_yearly', 'max_users', 'included_modules', 'features']),
        ];
    }

    public function changePlan(Request $request, ChangePlan $change)
    {
        $data = $request->validate([
            'plan' => ['required', 'string', Rule::exists('plans', 'slug')->where('is_active', true)],
            'cycle' => 'required|in:monthly,yearly',
        ]);
        $result = $change(CurrentTenant::get(), Plan::where('slug', $data['plan'])->firstOrFail(), $data['cycle']);
        CurrentTenant::get()->refresh()->forgetModules();

        if ($result === 'requested') {
            return response()->json([
                'message' => 'Plan change requested. The BuildCRM team will confirm activation after payment.',
            ] + $this->show(), 202);
        }

        return ['message' => 'Your plan has been changed.'] + $this->show();
    }
}
