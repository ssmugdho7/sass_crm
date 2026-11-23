<?php

namespace Tests\Feature\Account;

class RoleTest extends AccountTestCase
{
    public function test_permission_catalog_only_includes_enabled_modules(): void
    {
        $this->actingAsOwner();
        $modules = collect($this->getJson('/api/app/team/permissions')->assertOk()->json('data'))->pluck('module');
        $this->assertContains('leads', $modules);
        $this->assertContains('appointments', $modules); // included in Growth
        $this->assertNotContains('timesheets', $modules);
    }

    public function test_permissions_are_validated_against_enabled_modules(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/app/team/roles', ['name' => 'Estimator', 'permissions' => ['estimates.view', 'timesheets.view']])
            ->assertUnprocessable()->assertJsonValidationErrors('permissions');
        $this->postJson('/api/app/team/roles', ['name' => 'Estimator', 'permissions' => ['estimates.view', 'bogus.perm']])
            ->assertUnprocessable();

        $this->postJson('/api/app/addons/timesheets/install')->assertAccepted();
        $this->approveAddon('timesheets');
        $this->postJson('/api/app/team/roles', ['name' => 'Estimator', 'permissions' => ['estimates.view', 'timesheets.view']])
            ->assertCreated()->assertJsonPath('slug', 'estimator');
        $this->postJson('/api/app/team/roles', ['name' => 'Admin', 'permissions' => ['*']])->assertCreated();
    }

    public function test_owner_role_is_locked_and_roles_in_use_cannot_be_deleted(): void
    {
        $this->actingAsOwner();
        $owner = $this->role('owner');
        $this->putJson("/api/app/team/roles/{$owner->id}", ['name' => 'Boss', 'permissions' => []])->assertUnprocessable();
        $this->deleteJson("/api/app/team/roles/{$owner->id}")->assertUnprocessable();

        $crew = $this->role('field-crew');
        $this->makeUser('field-crew');
        $this->deleteJson("/api/app/team/roles/{$crew->id}")->assertUnprocessable();

        $pm = $this->role('project-manager');
        $this->putJson("/api/app/team/roles/{$pm->id}", ['name' => 'PM', 'permissions' => ['projects.view']])->assertOk()->assertJsonPath('name', 'PM');
        $this->deleteJson("/api/app/team/roles/{$pm->id}")->assertNoContent();
    }
}
