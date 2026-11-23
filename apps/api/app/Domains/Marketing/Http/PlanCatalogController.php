<?php

namespace App\Domains\Marketing\Http;

use App\Models\Plan;

/** Public pricing data for the marketing site and sign-up form. */
class PlanCatalogController
{
    public function __invoke()
    {
        $plans = Plan::where('is_active', true)->orderBy('sort')->orderBy('id')
            ->get(['id', 'name', 'slug', 'price_monthly', 'price_yearly', 'max_users', 'features', 'included_modules']);

        $addons = collect(config('crm_modules'))
            ->reject(fn ($m) => $m['core'])
            ->map(fn ($m, $key) => ['key' => $key, 'name' => $m['name'], 'description' => $m['description'], 'price' => $m['price']])
            ->values();

        return ['plans' => $plans, 'addons' => $addons];
    }
}
