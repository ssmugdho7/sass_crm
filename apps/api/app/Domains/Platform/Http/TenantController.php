<?php

namespace App\Domains\Platform\Http;

use App\Domains\Platform\PermissionCatalog;
use App\Models\Module;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TenantController
{
    public const STATUSES = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(self::STATUSES)], 'search' => 'nullable|string|max:120']);

        return Tenant::query()
            ->with(['plan:id,name,slug', 'users' => fn ($q) => $q->whereHas('role', fn ($r) => $r->where('slug', 'owner'))->select('id', 'tenant_id', 'name', 'email')])
            ->withCount('users')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $s = '%'.$request->string('search').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $s)->orWhere('slug', 'like', $s)->orWhere('email', 'like', $s));
            })
            ->latest('id')
            ->paginate(25)
            ->through(function (Tenant $t) {
                $data = $t->toArray();
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
            'tenant' => $tenant,
            'modules' => $catalog->map(fn (Module $m) => [
                'key' => $m->key, 'name' => $m->name, 'category' => $m->category, 'is_core' => $m->is_core, 'price_monthly' => $m->price_monthly,
                'status' => $m->is_core ? 'core' : ($installed[$m->key]->status ?? 'not_installed'),
                'included_in_plan' => in_array($m->key, $tenant->plan?->included_modules ?? [], true),
            ]),
            'users' => User::query()->where('tenant_id', $tenant->id)->with('role:id,name,slug')->orderBy('id')->get(),
            'roles' => Role::query()->where('tenant_id', $tenant->id)->select('roles.*')->selectSub(User::query()->selectRaw('count(*)')->whereColumn('users.role_id', 'roles.id'), 'users_count')->orderBy('id')->get(),
        ];
    }

    public function update(Request $request, Tenant $tenant)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'slug' => ['sometimes', 'required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('tenants', 'slug')->ignore($tenant->id)],
            'email' => 'sometimes|nullable|email|max:190',
            'phone' => 'sometimes|nullable|string|max:40',
            'plan_id' => 'sometimes|nullable|integer|exists:plans,id',
            'status' => ['sometimes', 'required', Rule::in(self::STATUSES)],
            'billing_cycle' => ['sometimes', 'required', Rule::in(['monthly', 'yearly'])],
            'trial_ends_at' => 'sometimes|nullable|date',
            'current_period_end' => 'sometimes|nullable|date',
        ]);
        $tenant->update($data);

        return $tenant->fresh('plan');
    }

    public function toggleModule(Request $request, Tenant $tenant, string $key)
    {
        abort_unless(in_array($key, PermissionCatalog::addonKeys(), true), 422, 'Only add-on modules can be toggled.');
        $data = $request->validate(['enabled' => 'required|boolean']);

        $row = TenantModule::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id, 'module_key' => $key]);
        $row->status = $data['enabled'] ? 'active' : 'disabled';
        $row->save();

        return ['module_key' => $key, 'status' => $row->status];
    }

    public function destroy(Tenant $tenant)
    {
        DB::transaction(function () use ($tenant) {
            $userIds = User::query()->where('tenant_id', $tenant->id)->pluck('id');
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $userIds)->delete();
            TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->delete();
            User::query()->where('tenant_id', $tenant->id)->delete();
            Role::query()->where('tenant_id', $tenant->id)->delete();
            $tenant->delete();
        });

        return response()->noContent();
    }
}
