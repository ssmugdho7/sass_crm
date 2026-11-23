<?php

namespace App\Domains\Identity\Http;

use App\Domains\Identity\Actions\RegisterTenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController
{
    public function register(Request $request, RegisterTenant $register)
    {
        $data = $request->validate([
            'company' => 'required|string|max:120',
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:190|unique:users,email',
            'phone' => 'nullable|string|max:40',
            'password' => 'required|string|min:8',
            'plan' => 'nullable|string|exists:plans,slug',
        ]);
        $user = $register($data);

        return response()->json(['token' => $user->createToken('crm', ['crm'])->plainTextToken, 'user' => $this->me($user)], 201);
    }

    public function login(Request $request)
    {
        return $this->attempt($request, false);
    }

    public function platformLogin(Request $request)
    {
        return $this->attempt($request, true);
    }

    public function show(Request $request)
    {
        return ['user' => $this->me($request->user())];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function attempt(Request $request, bool $platform)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password) || $user->is_super_admin !== $platform) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }
        if ($user->status !== 'active') {
            throw ValidationException::withMessages(['email' => 'This account is disabled.']);
        }
        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken($platform ? 'platform' : 'crm', [$platform ? 'platform' : 'crm'])->plainTextToken;

        return ['token' => $token, 'user' => $this->me($user)];
    }

    /** Shape consumed by the web app session (lib/api.ts `Me`). */
    private function me(User $user): array
    {
        $tenant = $user->tenant?->load('plan');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_super_admin' => $user->is_super_admin,
            'role' => $user->role?->only(['id', 'name', 'slug']),
            'permissions' => $user->permissionList(),
            'tenant' => $tenant ? [
                'id' => $tenant->id, 'name' => $tenant->name, 'slug' => $tenant->slug, 'status' => $tenant->status,
                'trial_ends_at' => $tenant->trial_ends_at, 'plan' => $tenant->plan?->only(['id', 'name', 'slug']),
                'modules' => $tenant->enabledModuleKeys(),
            ] : null,
        ];
    }
}
