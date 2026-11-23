<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_crm_owner_logs_in_and_sees_core_modules(): void
    {
        $res = $this->postJson('/api/auth/login', ['email' => 'owner@demo.test', 'password' => 'password'])->assertOk();
        $this->assertContains('leads', $res->json('user.tenant.modules'));
        $this->assertSame(['*'], $res->json('user.permissions'));
    }

    public function test_super_admin_cannot_use_crm_login_and_vice_versa(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'admin@sasscrm.test', 'password' => 'password'])->assertStatus(422);
        $this->postJson('/api/auth/platform/login', ['email' => 'owner@demo.test', 'password' => 'password'])->assertStatus(422);
        $this->postJson('/api/auth/platform/login', ['email' => 'admin@sasscrm.test', 'password' => 'password'])->assertOk();
    }

    public function test_register_creates_tenant_with_owner(): void
    {
        $this->postJson('/api/auth/register', [
            'company' => 'Acme Roofing', 'name' => 'Ann', 'email' => 'ann@acme.test', 'password' => 'secret123', 'plan' => 'starter',
        ])->assertCreated()->assertJsonPath('user.tenant.slug', 'acme-roofing')->assertJsonPath('user.role.slug', 'owner');
    }
}
