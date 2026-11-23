<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Laravel\Sanctum\Sanctum;

/** Billing, add-ons and the company profile require account.manage; payment secrets also need payments.manage. */
class AccountPermissionTest extends AccountTestCase
{
    private function actingWith(array $permissions): User
    {
        $role = $this->role('project-manager');
        $role->update(['permissions' => $permissions]);
        $user = User::where('email', 'pm@demo.test')->first() ?? $this->makeUser('project-manager', 'pm@demo.test');
        Sanctum::actingAs($user, ['crm']);

        return $user;
    }

    public function test_team_manager_without_account_manage_is_forbidden(): void
    {
        $this->actingWith(['team.view', 'team.manage', 'payments.manage']);
        $this->getJson('/api/app/addons')->assertForbidden();
        $this->getJson('/api/app/addons/payment_gateway')->assertForbidden();
        $this->postJson('/api/app/addons/timesheets/install')->assertForbidden();
        $this->deleteJson('/api/app/addons/payment_gateway')->assertForbidden();
        $this->putJson('/api/app/addons/payment_gateway/config', ['secret_key' => 'sk_evil'])->assertForbidden();
        $this->getJson('/api/app/billing')->assertForbidden();
        $this->postJson('/api/app/billing/change-plan', ['plan' => 'pro', 'cycle' => 'monthly'])->assertForbidden();
        $this->putJson('/api/app/account/company', ['name' => 'Hacked'])->assertForbidden();
        $this->getJson('/api/app/account/company')->assertOk();
        $this->getJson('/api/app/team/users')->assertOk();
    }

    public function test_payment_gateway_config_requires_payments_manage(): void
    {
        $this->actingWith(['account.manage']);
        $this->getJson('/api/app/addons')->assertOk();
        $this->putJson('/api/app/addons/payment_gateway/config', ['secret_key' => 'sk_evil_1234'])->assertForbidden();
        $this->putJson('/api/app/addons/google_calendar/config', ['client_id' => 'abc'])->assertOk();
        $this->putJson('/api/app/account/company', ['name' => 'Demo Builders Ltd'])->assertOk();

        $this->actingWith(['account.manage', 'payments.manage']);
        $this->putJson('/api/app/addons/payment_gateway/config', ['secret_key' => 'sk_test_1234'])->assertOk();
    }

    public function test_default_manager_roles_lack_account_manage(): void
    {
        foreach (['project-manager', 'field-crew'] as $slug) {
            $this->assertNotContains('account.manage', $this->role($slug)->permissions);
        }
    }
}
