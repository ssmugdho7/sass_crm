<?php

namespace App\Domains\Account\Http;

use App\Domains\Account\Support\TeamGuard;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        TeamGuard::ensureCanAssignRole($request->user(), $this->findRole($data['role_id']));
        $user = $this->withSeat(fn () => User::create($data + ['tenant_id' => CurrentTenant::id(), 'status' => 'active']));

        return response()->json($this->present($user->load('role:id,name,slug')), 201);
    }

    public function update(Request $request, int $user)
    {
        $model = $this->find($user);
        $actor = $request->user();
        TeamGuard::ensureCanManageUser($actor, $model);
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
        if ($model->id === $actor->id) {
            // Own credentials change only through the profile endpoint, which demands the current password.
            $emailChanged = isset($data['email']) && strcasecmp($data['email'], $model->email) !== 0;
            if (isset($data['password']) || $emailChanged) {
                throw ValidationException::withMessages([
                    isset($data['password']) ? 'password' : 'email' => 'Use your profile settings to change your own email or password.',
                ]);
            }
        }
        $roleChanged = isset($data['role_id']) && (int) $data['role_id'] !== $model->role_id;
        if ($roleChanged) {
            abort_if($model->id === $actor->id, 403, 'You cannot change your own role.');
            TeamGuard::ensureCanAssignRole($actor, $this->findRole($data['role_id']));
            if ($this->isOwner($model)) {
                $this->ensureNotLastOwner($model, 'change the role of');
            }
        }
        $credentialsChanged = isset($data['password'])
            || (isset($data['email']) && strcasecmp($data['email'], $model->email) !== 0);
        $model->update($data);
        if ($credentialsChanged && $model->id !== $actor->id) {
            $model->tokens()->delete();
        }

        return $this->present($model->load('role:id,name,slug'));
    }

    public function disable(Request $request, int $user)
    {
        $model = $this->find($user);
        abort_if($model->id === $request->user()->id, 422, 'You cannot disable your own account.');
        TeamGuard::ensureCanManageUser($request->user(), $model);
        $this->ensureNotLastOwner($model, 'disable');
        $model->update(['status' => 'disabled']);
        $model->tokens()->delete();

        return $this->present($model->load('role:id,name,slug'));
    }

    public function enable(Request $request, int $user)
    {
        $model = $this->find($user);
        TeamGuard::ensureCanManageUser($request->user(), $model);
        if ($model->status !== 'active') {
            $this->withSeat(fn () => $model->update(['status' => 'active']));
        }

        return $this->present($model->load('role:id,name,slug'));
    }

    public function destroy(Request $request, int $user)
    {
        $model = $this->find($user);
        abort_if($model->id === $request->user()->id, 422, 'You cannot delete your own account.');
        TeamGuard::ensureCanManageUser($request->user(), $model);
        $this->ensureNotLastOwner($model, 'delete');
        $model->tokens()->delete();
        $model->delete();

        return response()->noContent();
    }

    private function find(int $id): User
    {
        return User::where('tenant_id', CurrentTenant::id())->findOrFail($id);
    }

    private function findRole(int $id): Role
    {
        return Role::where('tenant_id', CurrentTenant::id())->findOrFail($id);
    }

    private function present(User $u): array
    {
        return $u->only(['id', 'name', 'email', 'phone', 'status', 'role_id', 'last_login_at', 'created_at']) + ['role' => $u->role?->only(['id', 'name', 'slug'])];
    }

    private function activeCount(): int
    {
        return User::where('tenant_id', CurrentTenant::id())->where('status', 'active')->count();
    }

    /**
     * Run $activate (create/enable a user) only if a seat is free. The tenant row is locked so
     * concurrent requests serialise and cannot both take the last seat.
     */
    private function withSeat(callable $activate): mixed
    {
        return DB::transaction(function () use ($activate) {
            $tenant = Tenant::whereKey(CurrentTenant::id())->lockForUpdate()->firstOrFail();
            $max = $tenant->plan?->max_users;
            if ($max !== null && $this->activeCount() >= $max) {
                throw ValidationException::withMessages(['email' => "Your plan allows {$max} active users. Upgrade your plan to add more."]);
            }

            return $activate();
        });
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
