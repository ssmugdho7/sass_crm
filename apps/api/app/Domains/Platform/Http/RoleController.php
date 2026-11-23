<?php

namespace App\Domains\Platform\Http;

use App\Domains\Platform\PermissionCatalog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoleController
{
    public function catalog()
    {
        return ['modules' => PermissionCatalog::grouped()];
    }

    public function index(Tenant $tenant)
    {
        return Role::query()->where('tenant_id', $tenant->id)->select('roles.*')->selectSub(User::query()->selectRaw('count(*)')->whereColumn('users.role_id', 'roles.id'), 'users_count')->orderBy('id')->get();
    }

    public function store(Request $request, Tenant $tenant)
    {
        $data = $this->validated($request);
        $slug = $this->uniqueSlug($tenant, $data['name']);

        return response()->json(Role::create([
            'tenant_id' => $tenant->id, 'name' => $data['name'], 'slug' => $slug, 'permissions' => $data['permissions'], 'is_system' => false,
        ]), 201);
    }

    public function update(Request $request, Tenant $tenant, Role $role)
    {
        $this->ensureOwned($tenant, $role);
        $data = $this->validated($request);
        if ($role->is_system && ! in_array('*', $data['permissions'], true)) {
            throw ValidationException::withMessages(['permissions' => 'The owner role must keep full access (*).']);
        }
        $role->update(['name' => $data['name'], 'permissions' => $data['permissions']]);

        return $role;
    }

    public function destroy(Tenant $tenant, Role $role)
    {
        $this->ensureOwned($tenant, $role);
        abort_if($role->is_system, 422, 'The owner role cannot be deleted.');
        abort_if(User::query()->where('role_id', $role->id)->exists(), 422, 'Reassign this role\'s users before deleting it.');
        $role->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'permissions' => 'present|array',
            'permissions.*' => ['string', Rule::in([...PermissionCatalog::all(), '*'])],
        ]);
        $data['permissions'] = in_array('*', $data['permissions'], true) ? ['*'] : array_values(array_unique($data['permissions']));

        return $data;
    }

    private function ensureOwned(Tenant $tenant, Role $role): void
    {
        abort_unless($role->tenant_id === $tenant->id, 404);
    }

    private function uniqueSlug(Tenant $tenant, string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        $slug = $base;
        for ($i = 2; Role::query()->where('tenant_id', $tenant->id)->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
