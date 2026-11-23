<?php

namespace Tests\Feature\Account;

use App\Models\Plan;
use Laravel\Sanctum\Sanctum;

class SecurityNitsTest extends AccountTestCase
{
    private function accountManager(array $extra = []): void
    {
        $role = $this->role('project-manager');
        $role->update(['permissions' => [...$role->permissions, 'account.manage', ...$extra]]);
        Sanctum::actingAs($this->makeUser('project-manager', 'acct@demo.test'), ['crm']);
    }

    public function test_payment_gateway_install_and_uninstall_need_payments_manage(): void
    {
        $this->tenant()->update(['plan_id' => Plan::where('slug', 'starter')->value('id')]);
        $this->accountManager();
        $this->postJson('/api/app/addons/payment_gateway/install')->assertForbidden();
        $this->deleteJson('/api/app/addons/payment_gateway')->assertForbidden();
        $this->postJson('/api/app/addons/timesheets/install')->assertAccepted();
    }

    public function test_uninstalling_plan_included_addon_is_refused(): void
    {
        $this->actingAsOwner();
        $this->deleteJson('/api/app/addons/appointments')->assertStatus(422)->assertJsonFragment(['message' => 'Included in your plan']);
        $this->assertTrue($this->tenant()->hasModule('appointments'));
    }

    public function test_role_editor_must_hold_every_permission_on_the_role(): void
    {
        $role = $this->role('project-manager');
        $role->update(['permissions' => [...$role->permissions, 'team.view', 'team.manage']]);
        Sanctum::actingAs($this->makeUser('project-manager', 'pm@demo.test'), ['crm']);

        $crew = $this->role('field-crew');
        $crew->update(['permissions' => ['dashboard.view', 'invoices.view', 'invoices.manage']]);
        $this->putJson("/api/app/team/roles/{$crew->id}", ['name' => $crew->name, 'permissions' => ['dashboard.view']])->assertForbidden();
        $this->deleteJson("/api/app/team/roles/{$crew->id}")->assertForbidden();
        $this->assertContains('invoices.manage', $crew->fresh()->permissions);

        $crew->update(['permissions' => ['dashboard.view']]);
        $this->putJson("/api/app/team/roles/{$crew->id}", ['name' => $crew->name, 'permissions' => ['dashboard.view']])->assertOk();
    }
}
