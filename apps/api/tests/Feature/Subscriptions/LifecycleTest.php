<?php

namespace Tests\Feature\Subscriptions;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private function tenant(): Tenant
    {
        return Tenant::where('slug', 'demo-builders')->firstOrFail();
    }

    public function test_enforce_moves_lapsed_active_to_past_due_then_suspended(): void
    {
        $t = $this->tenant();
        $t->update(['status' => 'active', 'current_period_end' => now()->subDay()]);
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('past_due', $t->fresh()->status);

        $t->update(['current_period_end' => now()->subDays(8)]);
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('suspended', $t->fresh()->status);
    }

    public function test_enforce_leaves_paid_up_tenants_alone(): void
    {
        $t = $this->tenant();
        $t->update(['status' => 'active', 'current_period_end' => now()->addDays(3)]);
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('active', $t->fresh()->status);
    }

    public function test_suspended_or_expired_trial_tenant_is_locked_out_everywhere(): void
    {
        $owner = User::where('email', 'owner@demo.test')->firstOrFail();
        $t = $this->tenant();

        foreach ([['status' => 'suspended'], ['status' => 'trial', 'trial_ends_at' => now()->subDay()]] as $state) {
            $t->update($state);
            Sanctum::actingAs($owner->fresh(), ['crm']);
            $this->getJson('/api/app/dashboard')->assertStatus(402);
            $this->getJson('/api/public/sites/demo-builders')->assertNotFound();
        }

        $t->update(['status' => 'active', 'current_period_end' => now()->addMonth()]);
        Sanctum::actingAs($owner->fresh(), ['crm']);
        $this->getJson('/api/app/dashboard')->assertOk();
    }

    public function test_enforce_suspends_expired_trials_only(): void
    {
        $t = $this->tenant();
        $t->update(['status' => 'trial', 'trial_ends_at' => now()->addDay()]);
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('trial', $t->fresh()->status);

        $t->update(['trial_ends_at' => now()->subMinute()]);
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('suspended', $t->fresh()->status);
    }
}
