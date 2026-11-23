<?php

namespace App\Domains\Platform\Http;

use App\Domains\Account\Actions\ApplyPlan;
use App\Domains\Platform\Actions\DeleteTenant;
use App\Domains\Platform\PermissionCatalog;
use App\Models\Module;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TenantController
{
    public const STATUSES = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(self::STATUSES)], 'search' => 'nullable|string|max:120', 'pending' => 'nullable|boolean']);
        $plans = Plan::query()->get(['id', 'name', 'slug', 'price_monthly', 'price_yearly'])->keyBy('id');

        return Tenant::query()
            ->with(['plan:id,name,slug', 'users' => fn ($q) => $q->whereHas('role', fn ($r) => $r->where('slug', 'owner'))->select('id', 'tenant_id', 'name', 'email')])
            ->withCount('users')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->boolean('pending'), fn ($q) => $q->where(fn ($pending) => $pending->whereNotNull('requested_plan_id')->orWhereHas('modules', fn ($m) => $m->where('status', 'pending'))))
            ->when($request->filled('search'), function ($q) use ($request) {
                $s = '%'.$request->string('search').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $s)->orWhere('slug', 'like', $s)->orWhere('email', 'like', $s));
            })
            ->latest('id')
            ->paginate(25)
            ->through(function (Tenant $t) use ($plans) {
                $data = self::withRequest($t, $plans->get($t->requested_plan_id));
                $data['owner'] = $t->users->first()?->only(['id', 'name', 'email']);
                unset($data['users']);

                return $data;
            });
    }

    public function show(Tenant $tenant)
    {
        $tenant->load('plan');
        $installed = TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->get()->keyBy('module_key');
        $catalog = Module::query()->orderBy('is_core', 'desc')->orderBy('name')->get();

        return [
            'tenant' => self::withRequest($tenant, $tenant->requested_plan_id ? Plan::find($tenant->requested_plan_id) : null),
            'modules' => $catalog->map(fn (Module $m) => [
                'key' => $m->key, 'name' => $m->name, 'category' => $m->category, 'is_core' => $m->is_core, 'price_monthly' => $m->price_monthly,
                'status' => $m->is_core ? 'core' : ($installed[$m->key]->status ?? 'not_installed'),
                'included_in_plan' => in_array($m->key, $tenant->plan?->included_modules ?? [], true),
            ]),
            'users' => User::query()->where('tenant_id', $tenant->id)->with('role:id,name,slug')->orderBy('id')->get(),
            'roles' => Role::query()->where('tenant_id', $tenant->id)->select('roles.*')->selectSub(User::query()->selectRaw('count(*)')->whereColumn('users.role_id', 'roles.id'), 'users_count')->orderBy('id')->get(),
        ];
    }

    public function update(Request $request, Tenant $tenant, ApplyPlan $applyPlan)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'slug' => ['sometimes', 'required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('tenants', 'slug')->ignore($tenant->id)],
            'email' => 'sometimes|nullable|email|max:190',
            'phone' => 'sometimes|nullable|string|max:40',
            'plan_id' => 'sometimes|required|integer|exists:plans,id',
            'status' => ['sometimes', 'required', Rule::in(self::STATUSES)],
            'billing_cycle' => ['sometimes', 'required', Rule::in(['monthly', 'yearly'])],
            'trial_ends_at' => 'sometimes|nullable|date',
            'current_period_end' => 'sometimes|nullable|date',
        ]);

        // An active subscription must have a period end, or subscriptions:enforce can never lapse it.
        $status = $data['status'] ?? $tenant->status;
        $periodEnd = array_key_exists('current_period_end', $data) ? $data['current_period_end'] : $tenant->current_period_end;
        if ($status === 'active' && $periodEnd === null) {
            throw ValidationException::withMessages(['current_period_end' => 'Set the current period end for an active subscription.']);
        }

        DB::transaction(function () use ($data, $tenant, $applyPlan) {
            $planId = array_key_exists('plan_id', $data) ? $data['plan_id'] : $tenant->plan_id;
            $cycle = $data['billing_cycle'] ?? $tenant->billing_cycle ?? 'monthly';
            if ($planId !== null && ((int) $planId !== (int) $tenant->plan_id || $cycle !== $tenant->billing_cycle)) {
                // Entitlements, seats and request clearing live in ApplyPlan; never write plan_id directly.
                $applyPlan($tenant, Plan::findOrFail($planId), $cycle);
                unset($data['billing_cycle']);
            }
            unset($data['plan_id']);
            if ($data !== []) {
                $tenant->refresh()->update($data);
            }
        });

        return $tenant->fresh('plan');
    }

    /** Approve the tenant's pending plan request: apply it, activate, start a new billing period. */
    public function approvePlanRequest(Tenant $tenant, ApplyPlan $applyPlan)
    {
        DB::transaction(function () use ($tenant, $applyPlan) {
            // Re-read the request under a row lock: a concurrent approve/reject must not apply it twice.
            $locked = $this->lockPendingRequest($tenant);
            $plan = Plan::find($locked->requested_plan_id);
            abort_if($plan === null, 422, 'The requested plan no longer exists.');
            $cycle = $locked->requested_cycle === 'yearly' ? 'yearly' : 'monthly';

            $applyPlan($locked, $plan, $cycle);
            $locked->refresh()->update([
                'status' => 'active',
                'current_period_end' => $cycle === 'yearly' ? now()->addYear() : now()->addMonth(),
            ]);
        });

        return $this->show($tenant->fresh());
    }

    public function rejectPlanRequest(Tenant $tenant)
    {
        DB::transaction(function () use ($tenant) {
            $this->lockPendingRequest($tenant)
                ->update(['requested_plan_id' => null, 'requested_cycle' => null, 'plan_requested_at' => null]);
        });

        return $this->show($tenant->fresh());
    }

    private function lockPendingRequest(Tenant $tenant): Tenant
    {
        $locked = Tenant::whereKey($tenant->id)->lockForUpdate()->firstOrFail();
        abort_if($locked->requested_plan_id === null, 422, 'This account has no pending plan request.');

        return $locked;
    }

    /** Tenant JSON plus the pending plan request (requested_plan, requested_cycle, plan_requested_at). */
    private static function withRequest(Tenant $tenant, ?Plan $requested): array
    {
        $data = $tenant->toArray();
        $data['requested_plan'] = $requested?->only(['id', 'name', 'slug', 'price_monthly', 'price_yearly']);
        $data['plan_requested_at'] = $tenant->plan_requested_at?->toJSON();

        return $data;
    }

    public function toggleModule(Request $request, Tenant $tenant, string $key)
    {
        abort_unless(in_array($key, PermissionCatalog::addonKeys(), true), 422, 'Only add-on modules can be toggled.');
        $data = $request->validate(['enabled' => 'required|boolean']);

        $row = TenantModule::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id, 'module_key' => $key]);
        $row->status = $data['enabled'] ? 'active' : 'disabled';
        $row->source ??= 'addon';
        $row->save();

        return ['module_key' => $key, 'status' => $row->status];
    }

    public function destroy(Tenant $tenant, DeleteTenant $deleteTenant)
    {
        $deleteTenant->handle($tenant);

        return response()->json(['status' => 'scheduled'], 202);
    }
}
