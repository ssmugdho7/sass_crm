<?php

namespace App\Domains\Platform\Http;

use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;

class OverviewController
{
    public function __invoke()
    {
        $byStatus = Tenant::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        $mrr = Tenant::query()->join('plans', 'plans.id', '=', 'tenants.plan_id')
            ->where('tenants.status', 'active')
            ->select('tenants.billing_cycle', 'plans.price_monthly', 'plans.price_yearly')
            ->selectRaw('COUNT(*) as accounts')
            ->groupBy('tenants.billing_cycle', 'plans.price_monthly', 'plans.price_yearly')->get()
            ->sum(fn ($group) => (int) $group->accounts * ($group->billing_cycle === 'yearly'
                ? intdiv((int) $group->price_yearly, 12) : (int) $group->price_monthly));

        return [
            'tenants' => [
                'total' => (int) $byStatus->sum(),
                'by_status' => collect(['trial', 'active', 'past_due', 'suspended', 'cancelled'])
                    ->mapWithKeys(fn ($s) => [$s => (int) ($byStatus[$s] ?? 0)]),
            ],
            'pending_addon_requests' => TenantModule::withoutGlobalScope('tenant')->where('status', 'pending')->count(),
            'pending_plan_requests' => Tenant::query()->whereNotNull('requested_plan_id')->count(),
            'users' => User::query()->where('is_super_admin', false)->count(),
            'mrr' => $mrr,
            'signups_30d' => Tenant::query()->where('created_at', '>=', now()->subDays(30))->count(),
            'recent_tenants' => Tenant::query()->with('plan:id,name')->withCount('users')->latest('id')->limit(8)->get(),
        ];
    }
}
