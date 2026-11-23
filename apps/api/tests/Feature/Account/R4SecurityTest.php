<?php

namespace Tests\Feature\Account;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class R4SecurityTest extends AccountTestCase
{
    public function test_team_endpoint_rejects_own_password_or_email_change(): void
    {
        $owner = $this->actingAsOwner();

        $this->putJson("/api/app/team/users/{$owner->id}", ['password' => 'hijacked-pass'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->putJson("/api/app/team/users/{$owner->id}", ['email' => 'evil@demo.test'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->assertTrue(Hash::check('password', $owner->fresh()->password));
        $this->assertSame('owner@demo.test', $owner->fresh()->email);

        // Same email (any case) and other fields are still fine.
        $this->putJson("/api/app/team/users/{$owner->id}", ['name' => 'Renamed', 'email' => 'OWNER@demo.test'])->assertOk();

        // Managing someone else's credentials still works.
        $crew = $this->makeUser('field-crew');
        $this->putJson("/api/app/team/users/{$crew->id}", ['password' => 'new-password-1'])->assertOk();
        $this->assertTrue(Hash::check('new-password-1', $crew->fresh()->password));
    }

    public function test_profile_password_change_revokes_other_tokens_only(): void
    {
        $owner = $this->owner();
        $other = $owner->createToken('crm', ['crm'])->plainTextToken;
        $current = $owner->createToken('crm', ['crm'])->plainTextToken;

        $this->withToken($current)->putJson('/api/app/account/profile', [
            'name' => 'Owner', 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass', 'current_password' => 'password',
        ])->assertOk();

        $this->assertSame(1, $owner->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($current)->getJson('/api/auth/me')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_enable_respects_seat_limit(): void
    {
        $t = $this->tenant();
        $t->update(['plan_id' => Plan::where('slug', 'starter')->value('id')]); // 3 seats
        $this->actingAsOwner();
        $a = $this->makeUser('field-crew', 'a@demo.test');
        $b = $this->makeUser('field-crew', 'b@demo.test');
        $b->update(['status' => 'disabled']);
        $active = User::where('tenant_id', $t->id)->where('status', 'active')->count();
        if ($active < 3) {
            $this->makeUser('field-crew', 'c@demo.test');
        }

        $this->postJson("/api/app/team/users/{$b->id}/enable")->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson("/api/app/team/users/{$a->id}/disable")->assertOk();
        $this->postJson("/api/app/team/users/{$b->id}/enable")->assertOk()->assertJsonPath('status', 'active');
    }
}
