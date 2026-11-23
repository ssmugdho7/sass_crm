<?php

namespace App\Domains\Account\Http;

use App\Domains\Account\Support\Permissions;
use App\Domains\Account\Support\TeamGuard;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoleController
{
    public function index()
    {
        return ['data' => Role::select('roles.*')->where('tenant_id', CurrentTenant::id())
            ->addSelect(['users_count' => User::selectRaw('count(*)')->whereColumn('users.role_id', 'roles.id')])
            ->orderByDesc('is_system')->orderBy('name')->get()];
    }

    public function catalog()
    {
        return ['data' => Permissions::grouped(CurrentTenant::get())];
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        TeamGuard::ensureCanGrant($request->user(), $data['permissions']);
        $slug = $base = Str::slug($data['name']) ?: 'role';
        for ($i = 2; Role::where('tenant_id', CurrentTenant::id())->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return response()->json(Role::create([
            'tenant_id' => CurrentTenant::id(), 'name' => $data['name'], 'slug' => $slug,
            'permissions' => $data['permissions'], 'is_system' => false,
        ]), 201);
    }

    public function update(Request $request, int $role)
    {
        $model = $this->find($role);
        abort_if($model->is_system, 422, 'The owner role is locked.');
        TeamGuard::ensureCanEditRole($request->user(), $model);
        $data = $this->validated($request, $model);
        TeamGuard::ensureCanGrant($request->user(), $data['permissions']);
        $model->update($data);

        return $model;
    }

    public function destroy(Request $request, int $role)
    {
        $model = $this->find($role);
        abort_if($model->is_system, 422, 'The owner role is locked.');
        TeamGuard::ensureCanEditRole($request->user(), $model);
        abort_if(User::where('role_id', $model->id)->exists(), 422, 'Reassign the users in this role before deleting it.');
        $model->delete();

        return response()->noContent();
    }

    private function find(int $id): Role
    {
        return Role::where('tenant_id', CurrentTenant::id())->findOrFail($id);
    }

    private function validated(Request $request, ?Role $role = null): array
    {
        $allowed = Permissions::allowed(CurrentTenant::get());
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('roles', 'name')->where('tenant_id', CurrentTenant::id())->ignore($role?->id)],
            'permissions' => 'present|array',
            'permissions.*' => 'string|distinct',
        ]);
        $invalid = array_diff($data['permissions'], [...$allowed, '*']);
        if ($invalid) {
            throw ValidationException::withMessages(['permissions' => 'Unknown or unavailable permissions: '.implode(', ', $invalid)]);
        }
        $data['permissions'] = array_values($data['permissions']);

        return $data;
    }
}
