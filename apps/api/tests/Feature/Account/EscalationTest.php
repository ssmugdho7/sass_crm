<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Laravel\Sanctum\Sanctum;

/** A user with team.manage (but not '*') must not be able to escalate privileges. */
class EscalationTest extends AccountTestCase
{
    private function teamManager(): User
    {
        $role = $this->role('project-manager');
        $role->update(['permissions' => [...$role->permissions, 'team.view', 'team.manage']]);
        $manager = $this->makeUser('project-manager', 'pm@demo.test');
        Sanctum::actingAs($manager, ['crm']);

        return $manager;
    }

    public function test_manager_cannot_take_over_or_manage_owner(): void
    {
        $owner = $this->owner();
        $this->teamManager();

        $this->putJson("/api/app/team/users/{$owner->id}", ['email' => 'evil@demo.test'])->assertForbidden();
        $this->putJson("/api/app/team/users/{$owner->id}", ['password' => 'hijacked123'])->assertForbidden();
        $this->putJson("/api/app/team/users/{$owner->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->postJson("/api/app/team/users/{$owner->id}/disable")->assertForbidden();
        $this->postJson("/api/app/team/users/{$owner->id}/enable")->assertForbidden();
        $this->deleteJson("/api/app/team/users/{$owner->id}")->assertForbidden();
        $this->assertSame('owner@demo.test', $owner->fresh()->email);
    }

    public function test_manager_cannot_take_over_peer_with_permissions_they_lack(): void
    {
        $this->teamManager();
        $accountant = $this->role('field-crew');
        $accountant->update(['permissions' => ['dashboard.view', 'invoices.view', 'invoices.manage']]);
        $peer = $this->makeUser('field-crew', 'accountant@demo.test');

        $this->putJson("/api/app/team/users/{$peer->id}", ['password' => 'hijacked123'])->assertForbidden();
        $this->putJson("/api/app/team/users/{$peer->id}", ['email' => 'evil@demo.test'])->assertForbidden();
        $this->putJson("/api/app/team/users/{$peer->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->postJson("/api/app/team/users/{$peer->id}/disable")->assertForbidden();
        $this->postJson("/api/app/team/users/{$peer->id}/enable")->assertForbidden();
        $this->deleteJson("/api/app/team/users/{$peer->id}")->assertForbidden();
        $this->assertSame('accountant@demo.test', $peer->fresh()->email);
        $this->assertSame('active', $peer->fresh()->status);

        // A peer whose permissions the manager fully holds can still be managed.
        $accountant->update(['permissions' => ['dashboard.view', 'invoices.view']]);
        $this->putJson("/api/app/team/users/{$peer->id}", ['name' => 'Renamed'])->assertOk();
        $this->postJson("/api/app/team/users/{$peer->id}/disable")->assertOk();
    }

    public function test_manager_can_edit_own_profile_fields(): void
    {
        $manager = $this->teamManager();
        $this->putJson("/api/app/team/users/{$manager->id}", ['name' => 'Me'])->assertOk();
    }

    public function test_manager_cannot_assign_owner_role_to_self_or_others(): void
    {
        $manager = $this->teamManager();
        $ownerRole = $this->role('owner');

        $this->putJson("/api/app/team/users/{$manager->id}", ['role_id' => $ownerRole->id])->assertForbidden();
        $this->assertSame($this->role('project-manager')->id, $manager->fresh()->role_id);

        // Cannot change own role at all, even to a lesser one.
        $this->putJson("/api/app/team/users/{$manager->id}", ['role_id' => $this->role('field-crew')->id])->assertForbidden();

        $crew = $this->makeUser('field-crew');
        $this->putJson("/api/app/team/users/{$crew->id}", ['role_id' => $ownerRole->id])->assertForbidden();
        $this->postJson('/api/app/team/users', [
            'name' => 'Sock', 'email' => 'sock@demo.test', 'password' => 'password1', 'role_id' => $ownerRole->id,
        ])->assertForbidden();
        $this->assertNull(User::where('email', 'sock@demo.test')->first());
    }

    public function test_manager_cannot_create_or_edit_roles_beyond_their_permissions(): void
    {
        $this->teamManager();
        $this->postJson('/api/app/team/roles', ['name' => 'Admin', 'permissions' => ['*']])->assertForbidden();
        $this->postJson('/api/app/team/roles', ['name' => 'Billing', 'permissions' => ['invoices.manage']])->assertForbidden();
        $this->postJson('/api/app/team/roles', ['name' => 'Helper', 'permissions' => ['tasks.view', 'tasks.manage']])->assertCreated();

        $crew = $this->role('field-crew');
        $this->putJson("/api/app/team/roles/{$crew->id}", ['name' => 'Field Crew', 'permissions' => ['*']])->assertForbidden();
        $this->putJson("/api/app/team/roles/{$crew->id}", ['name' => 'Field Crew', 'permissions' => ['tasks.view', 'website.manage']])->assertForbidden();
        $this->putJson("/api/app/team/roles/{$crew->id}", ['name' => 'Field Crew', 'permissions' => ['tasks.view']])->assertOk();

        // Cannot assign a role that holds permissions the manager lacks.
        $crew->update(['permissions' => ['tasks.view', 'invoices.manage']]);
        $this->postJson('/api/app/team/users', [
            'name' => 'Pat', 'email' => 'pat@demo.test', 'password' => 'password1', 'role_id' => $crew->id,
        ])->assertForbidden();
    }

    public function test_manager_cannot_edit_or_delete_own_role_or_full_access_roles(): void
    {
        $this->teamManager();
        $pm = $this->role('project-manager');
        $this->putJson("/api/app/team/roles/{$pm->id}", ['name' => 'PM', 'permissions' => $pm->permissions])->assertForbidden();
        $this->deleteJson("/api/app/team/roles/{$pm->id}")->assertForbidden();

        Sanctum::actingAs($this->owner(), ['crm']);
        $admin = $this->postJson('/api/app/team/roles', ['name' => 'Admin', 'permissions' => ['*']])->assertCreated()->json('id');
        $this->teamManager2();
        $this->putJson("/api/app/team/roles/{$admin}", ['name' => 'Admin', 'permissions' => ['tasks.view']])->assertForbidden();
        $this->deleteJson("/api/app/team/roles/{$admin}")->assertForbidden();
    }

    private function teamManager2(): void
    {
        Sanctum::actingAs(User::where('email', 'pm@demo.test')->firstOrFail(), ['crm']);
    }

    public function test_admin_credential_change_revokes_target_tokens(): void
    {
        $crew = $this->makeUser('field-crew');
        $crew->createToken('crm', ['crm']);
        $this->actingAsOwner();

        $this->putJson("/api/app/team/users/{$crew->id}", ['name' => 'Renamed'])->assertOk();
        $this->assertSame(1, $crew->tokens()->count());

        $this->putJson("/api/app/team/users/{$crew->id}", ['password' => 'newpassword1'])->assertOk();
        $this->assertSame(0, $crew->tokens()->count());

        $crew->createToken('crm', ['crm']);
        $this->putJson("/api/app/team/users/{$crew->id}", ['email' => 'moved@demo.test'])->assertOk();
        $this->assertSame(0, $crew->tokens()->count());
    }

    public function test_owner_flows_still_work(): void
    {
        $owner = $this->actingAsOwner();
        $second = $this->postJson('/api/app/team/users', [
            'name' => 'Co-owner', 'email' => 'co@demo.test', 'password' => 'password1', 'role_id' => $this->role('owner')->id,
        ])->assertCreated()->json('id');
        $this->putJson("/api/app/team/users/{$second}", ['email' => 'co2@demo.test', 'password' => 'password2'])->assertOk();
        $this->putJson("/api/app/team/users/{$second}", ['role_id' => $this->role('project-manager')->id])->assertOk();
        $this->putJson("/api/app/team/users/{$owner->id}", ['name' => 'Me Renamed'])->assertOk();

        $pm = $this->role('project-manager');
        $this->putJson("/api/app/team/roles/{$pm->id}", ['name' => 'PM', 'permissions' => ['*']])->assertOk();
        $this->postJson('/api/app/team/roles', ['name' => 'Admin', 'permissions' => ['*']])->assertCreated();
    }
}
