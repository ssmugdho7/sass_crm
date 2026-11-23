<?php

namespace Tests\Feature\Account;

use App\Models\Plan;
use App\Models\TenantModule;

class PlanChangeTest extends AccountTestCase
{
    private function activate(string $plan = 'growth', string $cycle = 'monthly'): void
    {
        $this->tenant()->update([
            'status' => 'active', 'plan_id' => Plan::where('slug', $plan)->value('id'),
            'billing_cycle' => $cycle, 'current_period_end' => now()->addDays(10),
        ]);
    }

    private function module(string $key): ?TenantModule
    {
        return TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant()->id)->where('module_key', $key)->first();
    }

    public function test_trial_tenant_only_records_a_request(): void
    {
        $this->actingAsOwner();
        $before = $this->tenant();
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'yearly'])
            ->assertStatus(202)
            ->assertJsonPath('status', 'trial')
            ->assertJsonPath('plan.slug', 'growth')
            ->assertJsonPath('requested_plan.slug', 'pro')
            ->assertJsonPath('requested_cycle', 'yearly')
            ->assertJsonPath('can_self_change', false)
            ->assertJsonFragment(['message' => 'Plan change requested. The BuildCRM team will confirm activation after payment.']);

        $after = $this->tenant();
        $this->assertSame('trial', $after->status);
        $this->assertSame($before->plan_id, $after->plan_id);
        $this->assertNull($after->current_period_end);
        $this->assertNotNull($after->plan_requested_at);
        $this->assertFalse($after->hasModule('google_calendar'), 'pro modules are not granted before payment');
    }

    public function test_past_due_tenant_only_records_a_request(): void
    {
        $this->tenant()->update(['status' => 'past_due', 'current_period_end' => now()->subDay()]);
        $this->actingAsOwner();
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'monthly'])->assertStatus(202)
            ->assertJsonPath('status', 'past_due');
        $tenant = $this->tenant();
        $this->assertSame('past_due', $tenant->status);
        $this->assertTrue($tenant->current_period_end->isPast());
    }

    public function test_active_tenant_changes_plan_without_touching_status_or_period(): void
    {
        $this->activate();
        $period = $this->tenant()->current_period_end;
        $this->actingAsOwner();
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'yearly'])->assertOk()
            ->assertJsonPath('plan.slug', 'pro')->assertJsonPath('status', 'active')
            ->assertJsonPath('billing_cycle', 'yearly')->assertJsonPath('requested_plan', null);

        $tenant = $this->tenant();
        $this->assertSame('active', $tenant->status);
        $this->assertEquals($period->getTimestamp(), $tenant->current_period_end->getTimestamp());
        $this->assertTrue($tenant->hasModule('timesheets'));
        $this->assertSame('plan', $this->module('timesheets')->source);
    }

    public function test_downgrade_disables_old_plan_modules_but_keeps_separate_addons(): void
    {
        $this->activate('pro');
        $this->actingAsOwner();
        // Rows as created for a Pro tenant; timesheets was bought separately before.
        foreach (['google_calendar', 'subcontractors', 'expenses', 'appointments', 'payment_gateway'] as $key) {
            TenantModule::withoutGlobalScope('tenant')->updateOrCreate(['tenant_id' => $this->tenant()->id, 'module_key' => $key], ['status' => 'active', 'source' => 'plan']);
        }
        TenantModule::withoutGlobalScope('tenant')->updateOrCreate(['tenant_id' => $this->tenant()->id, 'module_key' => 'timesheets'], ['status' => 'active', 'source' => 'addon']);

        $this->postJson('/api/app/billing/change-plan', ['plan' => 'growth', 'cycle' => 'monthly'])->assertOk();
        $tenant = $this->tenant();
        $this->assertFalse($tenant->hasModule('google_calendar'));
        $this->assertFalse($tenant->hasModule('subcontractors'));
        $this->assertFalse($tenant->hasModule('expenses'));
        $this->assertTrue($tenant->hasModule('timesheets'), 'separately installed add-on stays');
        $this->assertTrue($tenant->hasModule('appointments'), 'still included in the new plan');
        $this->assertTrue($tenant->hasModule('payment_gateway'));
    }

    public function test_addon_install_marks_source_addon_and_register_marks_plan(): void
    {
        $this->assertSame('plan', $this->module('payment_gateway')->source);
        $this->actingAsOwner();
        $this->postJson('/api/app/addons/google_calendar/install')->assertOk();
        $this->assertSame('addon', $this->module('google_calendar')->source);
        // Reinstalling an already-active plan module keeps it plan-sourced.
        $this->postJson('/api/app/addons/payment_gateway/install')->assertOk();
        $this->assertSame('plan', $this->module('payment_gateway')->source);
    }

    public function test_downgrade_rejected_when_users_exceed_plan_limit(): void
    {
        $this->activate('growth');
        foreach (range(1, 3) as $i) {
            $this->makeUser('field-crew', "crew{$i}@demo.test");
        }
        $this->actingAsOwner();
        $res = $this->postJson('/api/app/billing/change-plan', ['plan' => 'starter', 'cycle' => 'monthly'])
            ->assertUnprocessable()->assertJsonValidationErrors('plan');
        $this->assertStringContainsString('allows 3 active users', $res->json('errors.plan.0'));
        $this->assertSame('growth', $this->tenant()->plan->slug);
    }
}
