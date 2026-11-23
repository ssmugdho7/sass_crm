<?php

namespace Tests\Feature\Account;

use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class BillingAndProfileTest extends AccountTestCase
{
    public function test_billing_overview_reports_addon_cost(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/app/addons/timesheets/install')->assertOk();
        $this->getJson('/api/app/billing')->assertOk()
            ->assertJsonPath('plan.slug', 'growth')
            ->assertJsonPath('status', 'trial')
            ->assertJsonPath('addon_monthly_cost', 1000)
            ->assertJsonCount(3, 'plans');
    }

    public function test_change_plan_installs_included_modules(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'yearly'])->assertOk()
            ->assertJsonPath('plan.slug', 'pro')->assertJsonPath('status', 'active')->assertJsonPath('billing_cycle', 'yearly');
        $tenant = $this->tenant();
        $this->assertTrue($tenant->hasModule('timesheets'));
        $this->assertTrue($tenant->current_period_end->greaterThan(now()->addMonths(11)));
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'nope', 'cycle' => 'monthly'])->assertUnprocessable();
    }

    public function test_company_and_profile_updates(): void
    {
        $this->actingAsOwner();
        $this->getJson('/api/app/account/company')->assertOk()->assertJsonPath('slug', 'demo-builders');
        $this->putJson('/api/app/account/company', ['name' => 'Demo Builders Ltd', 'slug' => 'evil', 'phone' => '555'])
            ->assertOk()->assertJsonPath('name', 'Demo Builders Ltd')->assertJsonPath('slug', 'demo-builders');

        $this->putJson('/api/app/account/profile', ['name' => 'Me', 'password' => 'newpassword', 'password_confirmation' => 'newpassword', 'current_password' => 'wrong'])
            ->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->putJson('/api/app/account/profile', ['name' => 'Me', 'password' => 'newpassword', 'password_confirmation' => 'newpassword', 'current_password' => 'password'])
            ->assertOk()->assertJsonPath('name', 'Me');
        $this->assertTrue(Hash::check('newpassword', $this->owner()->password));
    }

    public function test_any_user_can_update_own_profile(): void
    {
        Sanctum::actingAs($this->makeUser('field-crew'), ['crm']);
        $this->putJson('/api/app/account/profile', ['name' => 'Crew Lead'])->assertOk()->assertJsonPath('name', 'Crew Lead');
    }
}
