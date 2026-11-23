<?php

namespace Tests\Feature\Account;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

abstract class AccountTestCase extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    protected function tenant(): Tenant
    {
        return Tenant::where('slug', 'demo-builders')->firstOrFail();
    }

    protected function owner(): User
    {
        return User::where('email', 'owner@demo.test')->firstOrFail();
    }

    protected function role(string $slug): Role
    {
        return Role::where('tenant_id', $this->tenant()->id)->where('slug', $slug)->firstOrFail();
    }

    protected function actingAsOwner(): User
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner, ['crm']);

        return $owner;
    }

    protected function makeUser(string $roleSlug, string $email = 'crew@demo.test'): User
    {
        return User::create([
            'tenant_id' => $this->tenant()->id, 'role_id' => $this->role($roleSlug)->id,
            'name' => 'Someone', 'email' => $email, 'password' => 'password', 'status' => 'active',
        ]);
    }
}
