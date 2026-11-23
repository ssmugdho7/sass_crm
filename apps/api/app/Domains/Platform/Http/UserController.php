<?php

namespace App\Domains\Platform\Http;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController
{
    public function index(Request $request)
    {
        $request->validate(['search' => 'nullable|string|max:120', 'tenant_id' => 'nullable|integer', 'status' => 'nullable|in:active,disabled']);

        return User::query()
            ->where('is_super_admin', false)
            ->with(['tenant:id,name,slug', 'role:id,name,slug'])
            ->when($request->filled('tenant_id'), fn ($q) => $q->where('tenant_id', $request->integer('tenant_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $s = '%'.$request->string('search').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $s)->orWhere('email', 'like', $s)->orWhere('phone', 'like', $s));
            })
            ->latest('id')
            ->paginate(25);
    }

    public function show(User $user)
    {
        abort_if($user->is_super_admin, 404);

        return $user->load(['tenant:id,name,slug', 'role:id,name,slug,permissions']);
    }

    public function update(Request $request, User $user)
    {
        abort_if($user->is_super_admin, 404);
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'email' => ['sometimes', 'required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'sometimes|nullable|string|max:40',
            'status' => 'sometimes|required|in:active,disabled',
            'role_id' => 'sometimes|nullable|integer',
            'password' => 'sometimes|nullable|string|min:8',
        ]);

        if (array_key_exists('role_id', $data) && $data['role_id'] !== null) {
            $ok = Role::query()->whereKey($data['role_id'])->where('tenant_id', $user->tenant_id)->exists();
            if (! $ok) {
                throw ValidationException::withMessages(['role_id' => 'Role must belong to the same CRM account.']);
            }
        }

        $revoke = false;
        if (! empty($data['password'])) {
            $revoke = true;
        } else {
            unset($data['password']);
        }
        if (isset($data['email']) && strcasecmp($data['email'], (string) $user->email) !== 0) {
            $revoke = true;
        }
        if (($data['status'] ?? null) === 'disabled' && $user->status !== 'disabled') {
            $revoke = true;
        }

        $user->update($data);
        if ($revoke) {
            $user->tokens()->delete();
        }

        return $user->fresh(['tenant:id,name,slug', 'role:id,name,slug']);
    }
}
