<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Laravel\Sanctum\Sanctum;

class TeamTest extends AccountTestCase
{
    public function test_owner_lists_and_creates_users(): void
    {
        $this->actingAsOwner();
        $this->getJson('/api/app/team/users')->assertOk()->assertJsonPath('max_users', 10)->assertJsonPath('data.0.role.slug', 'owner');

        $this->postJson('/api/app/team/users', [
            'name' => 'Pat', 'email' => 'pat@demo.test', 'password' => 'password1', 'role_id' => $this->role('field-crew')->id,
        ])->assertCreated()->assertJsonPath('role.slug', 'field-crew');
    }

    public function test_role_must_belong_to_tenant(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/auth/register', ['company' => 'Other Co', 'name' => 'X', 'email' => 'x@other.test', 'password' => 'password'])->assertCreated();
        $foreignRole = User::where('email', 'x@other.test')->first()->role_id;
        $this->actingAsOwner();
        $this->postJson('/api/app/team/users', [
            'name' => 'Pat', 'email' => 'pat@demo.test', 'password' => 'password1', 'role_id' => $foreignRole,
        ])->assertUnprocessable()->assertJsonValidationErrors('role_id');
    }

    public function test_max_users_is_enforced(): void
    {
        $this->tenant()->plan->update(['max_users' => 2]);
        $this->actingAsOwner();
        $payload = fn ($e) => ['name' => 'P', 'email' => $e, 'password' => 'password1', 'role_id' => $this->role('field-crew')->id];
        $this->postJson('/api/app/team/users', $payload('a@demo.test'))->assertCreated();
        $this->postJson('/api/app/team/users', $payload('b@demo.test'))->assertUnprocessable()->assertJsonValidationErrors('email');

        $a = User::where('email', 'a@demo.test')->first();
        $this->postJson("/api/app/team/users/{$a->id}/disable")->assertOk()->assertJsonPath('status', 'disabled');
        $this->postJson('/api/app/team/users', $payload('b@demo.test'))->assertCreated();
        $this->postJson("/api/app/team/users/{$a->id}/enable")->assertUnprocessable();
    }

    public function test_disable_revokes_tokens(): void
    {
        $crew = $this->makeUser('field-crew');
        $crew->createToken('crm', ['crm']);
        $this->actingAsOwner();
        $this->postJson("/api/app/team/users/{$crew->id}/disable")->assertOk();
        $this->assertSame(0, $crew->tokens()->count());
    }

    public function test_cannot_delete_or_disable_self_or_last_owner(): void
    {
        $owner = $this->actingAsOwner();
        $this->deleteJson("/api/app/team/users/{$owner->id}")->assertUnprocessable();
        $this->postJson("/api/app/team/users/{$owner->id}/disable")->assertUnprocessable();

        // With a second owner present, the first owner can be removed.
        $admin = $this->makeUser('owner', 'second@demo.test');
        Sanctum::actingAs($admin, ['crm']);
        $this->deleteJson("/api/app/team/users/{$owner->id}")->assertNoContent();
        $this->assertNull(User::find($owner->id));

        // Now `second` is the last owner; a manager with team.manage cannot delete, disable or demote them.
        $managerRole = $this->role('project-manager');
        $managerRole->update(['permissions' => [...$managerRole->permissions, 'team.view', 'team.manage']]);
        Sanctum::actingAs($this->makeUser('project-manager', 'pm@demo.test'), ['crm']);
        $this->deleteJson("/api/app/team/users/{$admin->id}")->assertForbidden();
        $this->postJson("/api/app/team/users/{$admin->id}/disable")->assertForbidden();
        $this->putJson("/api/app/team/users/{$admin->id}", ['role_id' => $managerRole->id])->assertForbidden();

        // Even the owner themselves cannot demote the last owner.
        Sanctum::actingAs($admin, ['crm']);
        $other = $this->makeUser('owner', 'third@demo.test');
        $other->update(['status' => 'disabled']);
        $this->deleteJson("/api/app/team/users/{$admin->id}")->assertUnprocessable();
    }

    public function test_field_crew_is_forbidden_from_team_management(): void
    {
        Sanctum::actingAs($this->makeUser('field-crew'), ['crm']);
        $this->getJson('/api/app/team/users')->assertForbidden();
        $this->postJson('/api/app/team/users', ['name' => 'x'])->assertForbidden();
        $this->postJson('/api/app/team/roles', ['name' => 'x', 'permissions' => []])->assertForbidden();
        $this->putJson('/api/app/account/company', ['name' => 'Hacked'])->assertForbidden();
        $this->getJson('/api/app/billing')->assertForbidden();
    }
}
