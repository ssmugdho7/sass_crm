<?php

namespace App\Domains\Account\Http;

use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AccountController
{
    public function company()
    {
        return CurrentTenant::get()->only(['id', 'name', 'slug', 'email', 'phone']);
    }

    public function updateCompany(Request $request)
    {
        $tenant = CurrentTenant::get();
        $tenant->update($request->validate([
            'name' => 'required|string|max:120',
            'email' => 'nullable|email|max:190',
            'phone' => 'nullable|string|max:40',
        ]));

        return $tenant->only(['id', 'name', 'slug', 'email', 'phone']);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:40',
            'password' => 'nullable|string|min:8|confirmed',
            'current_password' => 'required_with:password|nullable|string',
        ]);
        if (! empty($data['password'])) {
            if (! Hash::check($data['current_password'] ?? '', $user->password)) {
                throw ValidationException::withMessages(['current_password' => 'Your current password is incorrect.']);
            }
            $user->password = $data['password'];
        }
        $user->name = $data['name'];
        $user->phone = $data['phone'] ?? null;
        $passwordChanged = $user->isDirty('password');
        $user->save();
        if ($passwordChanged) {
            // Sign out every other session; keep the one making this request.
            $current = $user->currentAccessToken();
            $user->tokens()->when($current instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($current->getKey()))->delete();
        }

        return $user->only(['id', 'name', 'email', 'phone']);
    }
}
