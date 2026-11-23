<?php

namespace Tests\Feature\Subscriptions;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SuspendedRecoveryTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private function tenant(): Tenant
    {
        return Tenant::where('slug', 'demo-builders')->firstOrFail();
    }

    private function asOwner(): void
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs(User::where('email', 'owner@demo.test')->firstOrFail()->fresh(), ['crm']);
    }

    public function test_expired_trial_recovers_through_billing_request_and_approval(): void
    {
        $t = $this->tenant();
        $t->update(['status' => 'trial', 'trial_ends_at' => now()->subDay()]);
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('suspended', $t->fresh()->status);

        $this->asOwner();
        $this->getJson('/api/app/dashboard')->assertStatus(402);
        $this->getJson('/api/app/team/users')->assertStatus(402);
        $this->getJson('/api/auth/me')->assertOk()
            ->assertJsonPath('user.tenant.status', 'suspended')
            ->assertJsonPath('user.tenant.accessible', false);
        $this->getJson('/api/app/billing')->assertOk()->assertJsonPath('status', 'suspended')->assertJsonPath('accessible', false);
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'monthly'])->assertStatus(202)
            ->assertJsonPath('requested_plan.slug', 'pro');
        $this->assertSame('suspended', $t->fresh()->status);

        $this->app['auth']->forgetGuards();
        Sanctum::actingAs(User::where('email', 'admin@sasscrm.test')->firstOrFail(), ['platform']);
        $this->postJson("/api/platform/tenants/{$t->id}/plan-request/approve")->assertOk()->assertJsonPath('tenant.status', 'active');

        $this->asOwner();
        $this->getJson('/api/app/dashboard')->assertOk();
        $this->getJson('/api/auth/me')->assertJsonPath('user.tenant.accessible', true);
    }

    public function test_past_due_can_reach_billing_but_cancelled_cannot(): void
    {
        $t = $this->tenant();
        $t->update(['status' => 'past_due', 'current_period_end' => now()->subDay()]);
        $this->asOwner();
        $this->getJson('/api/app/billing')->assertOk();

        $t->update(['status' => 'cancelled']);
        $this->asOwner();
        $this->getJson('/api/app/billing')->assertStatus(402);
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'monthly'])->assertStatus(402);
    }

    public function test_billing_still_requires_account_manage_and_active_user(): void
    {
        $t = $this->tenant();
        $t->update(['status' => 'suspended']);
        $crewRole = $t->roles()->where('slug', 'field-crew')->firstOrFail();
        $crew = User::create(['tenant_id' => $t->id, 'role_id' => $crewRole->id, 'name' => 'C', 'email' => 'c@demo.test', 'password' => 'password', 'status' => 'active']);
        Sanctum::actingAs($crew, ['crm']);
        $this->getJson('/api/app/billing')->assertForbidden();

        $owner = User::where('email', 'owner@demo.test')->firstOrFail();
        $owner->update(['status' => 'disabled']);
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($owner->fresh(), ['crm']);
        $this->getJson('/api/app/billing')->assertForbidden();
    }

    public function test_downgrade_disables_plan_modules_but_keeps_addons(): void
    {
        $t = $this->tenant();
        TenantModule::withoutGlobalScope('tenant')->updateOrCreate(['tenant_id' => $t->id, 'module_key' => 'subcontractors'], ['status' => 'active', 'source' => 'addon']);
        $row = fn (string $k) => TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $t->id)->where('module_key', $k)->first();
        $this->assertSame('plan', $row('appointments')->source);
        $this->assertSame('addon', $row('subcontractors')->source);

        Sanctum::actingAs(User::where('email', 'admin@sasscrm.test')->firstOrFail(), ['platform']);
        $this->putJson("/api/platform/tenants/{$t->id}", ['plan_id' => Plan::where('slug', 'starter')->value('id')])->assertOk();
        $this->assertSame('disabled', $row('appointments')->status);
        $this->assertSame('active', $row('subcontractors')->status);
    }

    public function test_backfill_migration_sets_null_sources(): void
    {
        $t = $this->tenant();
        TenantModule::withoutGlobalScope('tenant')->updateOrCreate(['tenant_id' => $t->id, 'module_key' => 'subcontractors'], ['status' => 'active']);
        TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $t->id)->update(['source' => null]);
        $migration = require app_path('Domains/Account/Database/Migrations/2026_11_24_300000_backfill_tenant_module_source.php');
        $migration->up();

        $src = TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $t->id)->pluck('source', 'module_key');
        $this->assertSame('plan', $src['appointments']);
        $this->assertSame('addon', $src['subcontractors']);
        $this->assertFalse($src->contains(null));
    }

    public function test_platform_toggle_marks_module_as_addon(): void
    {
        $t = $this->tenant();
        Sanctum::actingAs(User::where('email', 'admin@sasscrm.test')->firstOrFail(), ['platform']);
        $this->putJson("/api/platform/tenants/{$t->id}/modules/google_calendar", ['enabled' => true])->assertOk();
        $this->assertSame('addon', TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $t->id)->where('module_key', 'google_calendar')->value('source'));
    }
}
