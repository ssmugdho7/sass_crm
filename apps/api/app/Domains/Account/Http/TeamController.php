<?php

namespace App\Domains\Account\Http;

use App\Models\Role;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TeamController
{
    public function index()
    {
        $tenant = CurrentTenant::get()->load('plan');

        return [
            'data' => User::where('tenant_id', $tenant->id)->with('role:id,name,slug')->orderBy('name')->get()
                ->map(fn (User $u) => $this->present($u)),
            'max_users' => $tenant->plan?->max_users,
            'active_users' => $this->activeCount(),
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:190|unique:users,email',
            'phone' => 'nullable|string|max:40',
            'password' => 'required|string|min:8',
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('tenant_id', CurrentTenant::id())],
        ]);
        $this->ensureSeatAvailable();
        $user = User::create($data + ['tenant_id' => CurrentTenant::id(), 'status' => 'active']);

        return response()->json($this->present($user->load('role:id,name,slug')), 201);
    }

    public function update(Request $request, int $user)
    {
        $model = $this->find($user);
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'email' => ['sometimes', 'required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($model->id)],
            'phone' => 'nullable|string|max:40',
            'password' => 'nullable|string|min:8',
            'role_id' => ['sometimes', 'required', 'integer', Rule::exists('roles', 'id')->where('tenant_id', CurrentTenant::id())],
        ]);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        if (isset($data['role_id']) && (int) $data['role_id'] !== $model->role_id && $this->isOwner($model)) {
            $this->ensureNotLastOwner($model, 'change the role of');
        }
        $model->update($data);

        return $this->present($model->load('role:id,name,slug'));
    }

    public function disable(Request $request, int $user)
    {
        $model = $this->find($user);
        abort_if($model->id === $request->user()->id, 422, 'You cannot disable your own account.');
        $this->ensureNotLastOwner($model, 'disable');
        $model->update(['status' => 'disabled']);
        $model->tokens()->delete();

        return $this->present($model->load('role:id,name,slug'));
    }

    public function enable(int $user)
    {
        $model = $this->find($user);
        if ($model->status !== 'active') {
            $this->ensureSeatAvailable();
            $model->update(['status' => 'active']);
        }

        return $this->present($model->load('role:id,name,slug'));
    }

    public function destroy(Request $request, int $user)
    {
        $model = $this->find($user);
        abort_if($model->id === $request->user()->id, 422, 'You cannot delete your own account.');
        $this->ensureNotLastOwner($model, 'delete');
        $model->tokens()->delete();
        $model->delete();

        return response()->noContent();
    }

    private function find(int $id): User
    {
        return User::where('tenant_id', CurrentTenant::id())->findOrFail($id);
    }

    private function present(User $u): array
    {
        return $u->only(['id', 'name', 'email', 'phone', 'status', 'role_id', 'last_login_at', 'created_at']) + ['role' => $u->role?->only(['id', 'name', 'slug'])];
    }

    private function activeCount(): int
    {
        return User::where('tenant_id', CurrentTenant::id())->where('status', 'active')->count();
    }

    private function ensureSeatAvailable(): void
    {
        $max = CurrentTenant::get()->plan?->max_users;
        if ($max !== null && $this->activeCount() >= $max) {
            throw ValidationException::withMessages(['email' => "Your plan allows {$max} active users. Upgrade your plan to add more."]);
        }
    }

    private function ownerRoleIds(): array
    {
        return Role::where('tenant_id', CurrentTenant::id())->where('is_system', true)->pluck('id')->all();
    }

    private function isOwner(User $u): bool
    {
        return in_array($u->role_id, $this->ownerRoleIds(), true);
    }

    private function ensureNotLastOwner(User $u, string $verb): void
    {
        if (! $this->isOwner($u) || $u->status !== 'active') {
            return;
        }
        $others = User::where('tenant_id', CurrentTenant::id())->whereIn('role_id', $this->ownerRoleIds())
            ->where('status', 'active')->whereKeyNot($u->id)->exists();
        abort_unless($others, 422, "You cannot {$verb} the last owner.");
    }
}
