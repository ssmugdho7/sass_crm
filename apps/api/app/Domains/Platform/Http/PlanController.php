<?php

namespace App\Domains\Platform\Http;

use App\Domains\Platform\PermissionCatalog;
use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlanController
{
    public function index()
    {
        return Plan::query()->orderBy('sort')->orderBy('id')->get()
            ->map(fn (Plan $p) => [...$p->toArray(), 'tenants_count' => Tenant::query()->where('plan_id', $p->id)->count()]);
    }

    public function store(Request $request)
    {
        return response()->json(Plan::create($this->validated($request)), 201);
    }

    public function update(Request $request, Plan $plan)
    {
        $plan->update($this->validated($request, $plan));

        return $plan;
    }

    public function destroy(Plan $plan)
    {
        abort_if(Tenant::query()->where('plan_id', $plan->id)->exists(), 422, 'This plan is in use by CRM accounts.');
        $plan->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?Plan $plan = null): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'slug' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('plans', 'slug')->ignore($plan?->id)],
            'price_monthly' => 'required|integer|min:0',
            'price_yearly' => 'required|integer|min:0',
            'max_users' => 'required|integer|min:1',
            'included_modules' => 'present|array',
            'included_modules.*' => ['string', Rule::in(PermissionCatalog::addonKeys())],
            'features' => 'present|array',
            'features.*' => 'string|max:160',
            'is_active' => 'boolean',
            'sort' => 'integer|min:0',
        ]);
        $data['included_modules'] = array_values(array_unique($data['included_modules']));
        $data['features'] = array_values(array_filter(array_map('trim', $data['features'])));

        return $data;
    }
}
