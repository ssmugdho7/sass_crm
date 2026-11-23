<?php

namespace Tests\Feature\Platform;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlanRequestTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private function tenant(): Tenant
    {
        return Tenant::where('slug', 'demo-builders')->firstOrFail();
    }

    private function asSuper(): void
    {
        Sanctum::actingAs(User::where('email', 'admin@sasscrm.test')->firstOrFail(), ['platform']);
    }

    private function requestPro(string $cycle = 'yearly'): void
    {
        Sanctum::actingAs(User::where('email', 'owner@demo.test')->firstOrFail(), ['crm']);
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => $cycle])->assertStatus(202);
        $this->app['auth']->forgetGuards();
    }

    private function module(string $key): ?TenantModule
    {
        return TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant()->id)->where('module_key', $key)->first();
    }

    public function test_pending_request_is_listed_filtered_and_counted(): void
    {
        $this->requestPro();
        $this->asSuper();
        $id = $this->tenant()->id;

        $this->getJson('/api/platform/tenants?pending=1')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.requested_plan.slug', 'pro')
            ->assertJsonPath('data.0.requested_cycle', 'yearly');
        $this->assertNotNull($this->getJson('/api/platform/tenants?pending=1')->json('data.0.plan_requested_at'));
        $this->getJson("/api/platform/tenants/{$id}")->assertOk()->assertJsonPath('tenant.requested_plan.slug', 'pro');
        $this->getJson('/api/platform/overview')->assertOk()->assertJsonPath('pending_plan_requests', 1);

        $this->postJson("/api/platform/tenants/{$id}/plan-request/reject")->assertOk()->assertJsonPath('tenant.requested_plan', null);
        $this->getJson('/api/platform/tenants?pending=1')->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame('trial', $this->tenant()->status);
        $this->postJson("/api/platform/tenants/{$id}/plan-request/reject")->assertStatus(422);
    }

    public function test_approve_applies_plan_activates_and_clears_request(): void
    {
        $this->requestPro('yearly');
        $this->asSuper();
        $id = $this->tenant()->id;

        $this->postJson("/api/platform/tenants/{$id}/plan-request/approve")->assertOk()
            ->assertJsonPath('tenant.status', 'active')
            ->assertJsonPath('tenant.requested_plan', null);

        $t = $this->tenant();
        $this->assertSame('pro', $t->plan->slug);
        $this->assertSame('yearly', $t->billing_cycle);
        $this->assertNull($t->requested_plan_id);
        $this->assertTrue($t->current_period_end->between(now()->addYear()->subMinute(), now()->addYear()->addMinute()));
        $this->assertSame('active', $this->module('timesheets')->status);
        $this->assertSame('plan', $this->module('timesheets')->source);

        $this->postJson("/api/platform/tenants/{$id}/plan-request/approve")->assertStatus(422);
    }

    public function test_approve_rejects_when_seats_do_not_fit(): void
    {
        $t = $this->tenant();
        $t->update(['requested_plan_id' => Plan::where('slug', 'starter')->value('id'), 'requested_cycle' => 'monthly', 'plan_requested_at' => now()]);
        foreach (range(1, 4) as $i) {
            User::create(['tenant_id' => $t->id, 'role_id' => $t->roles()->first()->id, 'name' => "U{$i}", 'email' => "u{$i}@demo.test", 'password' => 'password', 'status' => 'active']);
        }
        $this->asSuper();
        $this->postJson("/api/platform/tenants/{$t->id}/plan-request/approve")->assertStatus(422)->assertJsonValidationErrors('plan');
        $this->assertSame('trial', $this->tenant()->status);
        $this->assertNotNull($this->tenant()->requested_plan_id);
    }

    public function test_admin_plan_change_goes_through_apply_plan(): void
    {
        $this->asSuper();
        $t = $this->tenant();
        $this->assertSame('active', $this->module('payment_gateway')->status);

        $this->putJson("/api/platform/tenants/{$t->id}", ['plan_id' => Plan::where('slug', 'starter')->value('id')])->assertOk()
            ->assertJsonPath('plan.slug', 'starter');
        $this->assertSame('disabled', $this->module('payment_gateway')->status);

        $this->putJson("/api/platform/tenants/{$t->id}", ['plan_id' => Plan::where('slug', 'pro')->value('id'), 'billing_cycle' => 'yearly'])->assertOk();
        $this->assertSame('active', $this->module('expenses')->status);
        $this->assertSame('yearly', $this->tenant()->billing_cycle);
    }

    public function test_active_status_requires_period_end(): void
    {
        $this->asSuper();
        $t = $this->tenant();
        $this->assertNull($t->current_period_end);

        $this->putJson("/api/platform/tenants/{$t->id}", ['status' => 'active'])->assertStatus(422)->assertJsonValidationErrors('current_period_end');
        $this->putJson("/api/platform/tenants/{$t->id}", ['status' => 'active', 'current_period_end' => now()->addMonth()->toDateString()])->assertOk()
            ->assertJsonPath('status', 'active');
        $this->putJson("/api/platform/tenants/{$t->id}", ['current_period_end' => null])->assertStatus(422);
    }

    public function test_changing_user_email_revokes_tokens(): void
    {
        $owner = User::where('email', 'owner@demo.test')->firstOrFail();
        $owner->createToken('crm', ['crm']);
        $this->asSuper();
        $this->putJson("/api/platform/users/{$owner->id}", ['name' => 'Same Email', 'email' => 'owner@demo.test'])->assertOk();
        $this->assertSame(1, $owner->tokens()->count());
        $this->putJson("/api/platform/users/{$owner->id}", ['email' => 'new-owner@demo.test'])->assertOk();
        $this->assertSame(0, $owner->tokens()->count());
    }
}
