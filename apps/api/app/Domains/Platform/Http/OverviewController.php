<?php

namespace App\Domains\Platform\Http;

use App\Models\Tenant;
use App\Models\User;

class OverviewController
{
    public function __invoke()
    {
        $byStatus = Tenant::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        $mrr = Tenant::query()->with('plan')->where('status', 'active')->whereNotNull('plan_id')->get()
            ->sum(fn (Tenant $t) => $t->billing_cycle === 'yearly'
                ? intdiv((int) $t->plan->price_yearly, 12)
                : (int) $t->plan->price_monthly);

        return [
            'tenants' => [
                'total' => (int) $byStatus->sum(),
                'by_status' => collect(['trial', 'active', 'past_due', 'suspended', 'cancelled'])
                    ->mapWithKeys(fn ($s) => [$s => (int) ($byStatus[$s] ?? 0)]),
            ],
            'users' => User::query()->where('is_super_admin', false)->count(),
            'mrr' => $mrr,
            'signups_30d' => Tenant::query()->where('created_at', '>=', now()->subDays(30))->count(),
            'recent_tenants' => Tenant::query()->with('plan:id,name')->withCount('users')->latest('id')->limit(8)->get(),
        ];
    }
}
