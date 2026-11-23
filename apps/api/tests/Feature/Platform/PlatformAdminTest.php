<?php

namespace Tests\Feature\Platform;

use App\Domains\Platform\Jobs\PurgeTenant;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PlatformAdminTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private function superToken(): string
    {
        return $this->postJson('/api/auth/platform/login', ['email' => 'admin@sasscrm.test', 'password' => 'password'])->assertOk()->json('token');
    }

    private function crmToken(string $email = 'owner@demo.test', string $password = 'password'): string
    {
        return $this->postJson('/api/auth/login', ['email' => $email, 'password' => $password])->assertOk()->json('token');
    }

    private function asSuper(): static
    {
        return $this->withToken($this->superToken());
    }

    private function demoTenant(): Tenant
    {
        return User::where('email', 'owner@demo.test')->firstOrFail()->tenant;
    }

    public function test_crm_token_is_forbidden_on_platform_routes(): void
    {
        $token = $this->crmToken();
        foreach (['overview', 'tenants', 'users', 'plans', 'modules', 'permissions'] as $path) {
            $this->withToken($token)->getJson("/api/platform/{$path}")->assertForbidden();
        }
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/platform/overview')->assertUnauthorized();
    }

    public function test_overview_and_listings(): void
    {
        $tenant = $this->demoTenant();
        $tenant->update(['status' => 'active', 'billing_cycle' => 'yearly']);
        $growth = Plan::where('slug', 'growth')->first();

        $this->asSuper()->getJson('/api/platform/overview')->assertOk()
            ->assertJsonPath('tenants.by_status.active', 1)
            ->assertJsonPath('mrr', intdiv($growth->price_yearly, 12))
            ->assertJsonPath('users', 1);

        $this->getJson('/api/platform/tenants?search=demo')->assertOk()
            ->assertJsonPath('data.0.owner.email', 'owner@demo.test')
            ->assertJsonPath('data.0.users_count', 1)
            ->assertJsonPath('data.0.plan.slug', 'growth');
        $this->getJson('/api/platform/tenants?status=suspended')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/platform/tenants/{$tenant->id}")->assertOk()->assertJsonPath('tenant.id', $tenant->id)->assertJsonCount(3, 'roles');
        $this->getJson('/api/platform/users?search=owner@demo')->assertOk()->assertJsonPath('data.0.tenant.id', $tenant->id);
        $this->getJson('/api/platform/modules')->assertOk();
    }

    public function test_update_tenant_and_toggle_addon(): void
    {
        $tenant = $this->demoTenant();
        $this->asSuper()->putJson("/api/platform/tenants/{$tenant->id}", ['slug' => 'Bad Slug'])->assertStatus(422);
        $this->putJson("/api/platform/tenants/{$tenant->id}", ['name' => 'Renamed', 'status' => 'past_due', 'trial_ends_at' => '2027-01-01'])
            ->assertOk()->assertJsonPath('name', 'Renamed')->assertJsonPath('status', 'past_due');

        $this->putJson("/api/platform/tenants/{$tenant->id}/modules/leads", ['enabled' => true])->assertStatus(422);
        $this->putJson("/api/platform/tenants/{$tenant->id}/modules/timesheets", ['enabled' => true])->assertOk()->assertJsonPath('status', 'active');
        $this->assertTrue($tenant->fresh()->hasModule('timesheets'));
        $this->putJson("/api/platform/tenants/{$tenant->id}/modules/timesheets", ['enabled' => false])->assertOk();
        $this->assertFalse($tenant->fresh()->hasModule('timesheets'));
    }

    public function test_super_admin_resets_password_and_user_logs_in_with_it(): void
    {
        $user = User::where('email', 'owner@demo.test')->first();
        $old = $this->crmToken();

        $this->asSuper()->putJson("/api/platform/users/{$user->id}", ['password' => 'short'])->assertStatus(422);
        $this->putJson("/api/platform/users/{$user->id}", ['password' => 'new-secret-123'])->assertOk();
        $this->assertSame(0, $user->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withToken($old)->getJson('/api/auth/me')->assertUnauthorized();
        $this->postJson('/api/auth/login', ['email' => 'owner@demo.test', 'password' => 'password'])->assertStatus(422);
        $this->crmToken('owner@demo.test', 'new-secret-123');
    }

    public function test_disabling_user_revokes_tokens_and_blocks_login(): void
    {
        $user = User::where('email', 'owner@demo.test')->first();
        $this->crmToken();
        $this->assertSame(1, $user->tokens()->count());

        $this->asSuper()->putJson("/api/platform/users/{$user->id}", ['status' => 'disabled'])->assertOk()->assertJsonPath('status', 'disabled');
        $this->assertSame(0, $user->tokens()->count());
        $this->postJson('/api/auth/login', ['email' => 'owner@demo.test', 'password' => 'password'])->assertStatus(422);
    }

    public function test_user_role_must_belong_to_same_tenant(): void
    {
        $user = User::where('email', 'owner@demo.test')->first();
        $other = Tenant::create(['name' => 'Other', 'slug' => 'other']);
        $foreign = Role::create(['tenant_id' => $other->id, 'name' => 'X', 'slug' => 'x', 'permissions' => []]);
        $own = Role::where('tenant_id', $user->tenant_id)->where('slug', 'field-crew')->first();

        $this->asSuper()->putJson("/api/platform/users/{$user->id}", ['role_id' => $foreign->id])->assertStatus(422)->assertJsonValidationErrors('role_id');
        $this->putJson("/api/platform/users/{$user->id}", ['role_id' => $own->id])->assertOk()->assertJsonPath('role.slug', 'field-crew');
    }

    public function test_role_permission_validation_and_owner_protection(): void
    {
        $tenant = $this->demoTenant();
        $owner = Role::where('tenant_id', $tenant->id)->where('slug', 'owner')->first();

        $this->asSuper()->getJson('/api/platform/permissions')->assertOk()->assertJsonFragment(['key' => 'leads']);
        $this->postJson("/api/platform/tenants/{$tenant->id}/roles", ['name' => 'Bad', 'permissions' => ['leads.view', 'nope.hack']])
            ->assertStatus(422)->assertJsonValidationErrors('permissions.1');
        $role = $this->postJson("/api/platform/tenants/{$tenant->id}/roles", ['name' => 'Estimator', 'permissions' => ['estimates.view', 'estimates.manage']])
            ->assertCreated()->assertJsonPath('slug', 'estimator')->json();
        $this->putJson("/api/platform/tenants/{$tenant->id}/roles/{$role['id']}", ['name' => 'Estimator', 'permissions' => ['estimates.view']])
            ->assertOk()->assertJsonPath('permissions', ['estimates.view']);

        $this->putJson("/api/platform/tenants/{$tenant->id}/roles/{$owner->id}", ['name' => 'Owner', 'permissions' => ['leads.view']])->assertStatus(422);
        $this->deleteJson("/api/platform/tenants/{$tenant->id}/roles/{$owner->id}")->assertStatus(422);

        $crew = Role::where('tenant_id', $tenant->id)->where('slug', 'field-crew')->first();
        User::create(['tenant_id' => $tenant->id, 'role_id' => $crew->id, 'name' => 'C', 'email' => 'c@demo.test', 'password' => 'password']);
        $this->deleteJson("/api/platform/tenants/{$tenant->id}/roles/{$crew->id}")->assertStatus(422);
        $this->deleteJson("/api/platform/tenants/{$tenant->id}/roles/{$role['id']}")->assertNoContent();
    }

    public function test_plans_crud_and_in_use_guard(): void
    {
        $this->asSuper()->postJson('/api/platform/plans', [
            'name' => 'Ent', 'slug' => 'ent', 'price_monthly' => 29900, 'price_yearly' => 299000, 'max_users' => 200,
            'included_modules' => ['leads'], 'features' => [],
        ])->assertStatus(422)->assertJsonValidationErrors('included_modules.0');

        $plan = $this->postJson('/api/platform/plans', [
            'name' => 'Ent', 'slug' => 'ent', 'price_monthly' => 29900, 'price_yearly' => 299000, 'max_users' => 200,
            'included_modules' => ['timesheets'], 'features' => ['All the things'], 'is_active' => true, 'sort' => 4,
        ])->assertCreated()->json();
        $this->putJson("/api/platform/plans/{$plan['id']}", [...$plan, 'price_monthly' => 25000])->assertOk()->assertJsonPath('price_monthly', 25000);
        $this->deleteJson("/api/platform/plans/{$plan['id']}")->assertNoContent();

        $growth = Plan::where('slug', 'growth')->first();
        $this->deleteJson("/api/platform/plans/{$growth->id}")->assertStatus(422);
    }

    public function test_modules_update_and_tenant_delete(): void
    {
        $this->asSuper()->putJson('/api/platform/modules/timesheets', ['price_monthly' => 1200, 'is_active' => false])
            ->assertOk()->assertJsonPath('price_monthly', 1200)->assertJsonPath('is_active', false);
        $this->putJson('/api/platform/modules/leads', ['is_active' => false])->assertStatus(422);

    }

    public function test_tenant_delete_cancels_revokes_tokens_and_queues_purge(): void
    {
        Queue::fake();
        $crmToken = $this->crmToken();
        $tenant = $this->demoTenant();
        $userIds = User::where('tenant_id', $tenant->id)->pluck('id');
        $this->assertGreaterThan(0, DB::table('personal_access_tokens')->whereIn('tokenable_id', $userIds)->where('tokenable_type', User::class)->count());

        $this->flushHeaders();
        $this->asSuper()->deleteJson("/api/platform/tenants/{$tenant->id}")->assertStatus(202);

        Queue::assertPushed(PurgeTenant::class, fn (PurgeTenant $job) => $job->tenantId === $tenant->id);
        $this->assertSame('cancelled', $tenant->fresh()->status);
        $this->assertSame(0, DB::table('personal_access_tokens')->whereIn('tokenable_id', $userIds)->where('tokenable_type', User::class)->count());

        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->withToken($crmToken)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_purge_tenant_job_removes_files_google_grant_and_rows(): void
    {
        Storage::fake('public');
        Http::fake(['oauth2.googleapis.com/*' => Http::response('', 400)]);
        $tenant = $this->demoTenant();
        $other = Tenant::where('id', '!=', $tenant->id)->first();

        Storage::disk('public')->put("sites/{$tenant->id}/logo.png", 'x');
        if ($other) {
            Storage::disk('public')->put("sites/{$other->id}/logo.png", 'y');
        }
        DB::table('google_calendar_tokens')->insert([
            'tenant_id' => $tenant->id, 'access_token' => Crypt::encryptString('access-1'), 'refresh_token' => Crypt::encryptString('refresh-1'),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->asSuper()->deleteJson("/api/platform/tenants/{$tenant->id}")->assertStatus(202); // sync queue runs PurgeTenant inline

        Http::assertSent(fn ($req) => $req->url() === 'https://oauth2.googleapis.com/revoke' && $req['token'] === 'refresh-1');
        Storage::disk('public')->assertMissing("sites/{$tenant->id}/logo.png");
        $this->assertFalse(Storage::disk('public')->exists("sites/{$tenant->id}"));
        if ($other) {
            Storage::disk('public')->assertExists("sites/{$other->id}/logo.png");
        }
        $this->assertDatabaseMissing('tenants', ['id' => $tenant->id]);
        $this->assertDatabaseMissing('users', ['email' => 'owner@demo.test']);
        $this->assertDatabaseMissing('google_calendar_tokens', ['tenant_id' => $tenant->id]);

        (new PurgeTenant($tenant->id))->handle(); // idempotent when already gone
    }
}
