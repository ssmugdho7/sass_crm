<?php

namespace Tests\Feature\Account;

use App\Models\Module;
use App\Models\TenantModule;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

class AddonTest extends AccountTestCase
{
    public function test_catalog_lists_addons_with_install_and_plan_state(): void
    {
        $this->actingAsOwner();
        $res = $this->getJson('/api/app/addons')->assertOk();
        $addons = collect($res->json('data'))->keyBy('key');

        $this->assertFalse($addons->has('leads'), 'core modules are not add-ons');
        $this->assertTrue($addons['payment_gateway']['installed']);
        $this->assertTrue($addons['payment_gateway']['included_in_plan']);
        $this->assertFalse($addons['timesheets']['installed']);
        $this->assertFalse($addons['timesheets']['included_in_plan']);
        $this->assertSame(1000, $addons['timesheets']['price_monthly']);
    }

    public function test_inactive_modules_are_hidden(): void
    {
        Module::where('key', 'expenses')->update(['is_active' => false]);
        $this->actingAsOwner();
        $keys = collect($this->getJson('/api/app/addons')->json('data'))->pluck('key');
        $this->assertNotContains('expenses', $keys);
        $this->postJson('/api/app/addons/expenses/install')->assertNotFound();
    }

    public function test_install_and_uninstall_keeps_config(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/app/addons/google_calendar/install')->assertAccepted()->assertJsonPath('installed', false)->assertJsonPath('pending', true);
        $this->assertFalse($this->tenant()->hasModule('google_calendar'));
        $this->approveAddon('google_calendar');
        $this->assertTrue($this->tenant()->hasModule('google_calendar'));

        $this->putJson('/api/app/addons/google_calendar/config', ['client_id' => 'abc', 'client_secret' => 'supersecret1234'])->assertOk();
        $this->deleteJson('/api/app/addons/google_calendar')->assertOk()->assertJsonPath('installed', false);

        $this->assertFalse($this->tenant()->hasModule('google_calendar'));
        $row = TenantModule::withoutGlobalScope('tenant')->where('module_key', 'google_calendar')->first();
        $this->assertSame('disabled', $row->status);
        $this->assertSame('supersecret1234', $row->config['client_secret']);

        $this->postJson('/api/app/addons/google_calendar/install')->assertAccepted();
        $this->assertSame('abc', $row->fresh()->config['client_id']);
    }

    public function test_config_masks_secrets_and_keeps_existing_secret_on_blank(): void
    {
        $this->actingAsOwner();
        $res = $this->putJson('/api/app/addons/payment_gateway/config', [
            'publishable_key' => 'pk_test_1', 'secret_key' => 'sk_test_abcdWXYZ', 'webhook_secret' => 'whsec_9876', 'currency' => 'usd',
            'not_in_schema' => 'nope',
        ])->assertOk();

        $this->assertStringNotContainsString('sk_test_abcdWXYZ', $res->getContent());
        $this->assertStringNotContainsString('whsec_9876', $res->getContent());
        $fields = collect($res->json('fields'))->keyBy('key');
        $this->assertSame(['key' => 'secret_key', 'type' => 'secret', 'set' => true, 'hint' => '••••WXYZ'], $fields['secret_key']);
        $this->assertSame('pk_test_1', $fields['publishable_key']['value']);

        $this->putJson('/api/app/addons/payment_gateway/config', ['secret_key' => '', 'publishable_key' => 'pk_test_2'])->assertOk();
        $config = TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant()->id)->where('module_key', 'payment_gateway')->first()->config;
        $this->assertSame('sk_test_abcdWXYZ', $config['secret_key']);
        $this->assertSame('pk_test_2', $config['publishable_key']);
        $this->assertArrayNotHasKey('not_in_schema', $config);

        $list = $this->getJson('/api/app/addons')->assertOk();
        $this->assertStringNotContainsString('sk_test_abcdWXYZ', $list->getContent());
    }

    public function test_field_crew_cannot_manage_addons(): void
    {
        Sanctum::actingAs($this->makeUser('field-crew'), ['crm']);
        $this->getJson('/api/app/addons')->assertForbidden();
        $this->postJson('/api/app/addons/timesheets/install')->assertForbidden();
    }

    public function test_paid_addon_request_is_visible_to_platform_and_only_approval_enables_it(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/app/addons/timesheets/install')->assertAccepted()->assertJsonPath('pending', true);
        $this->postJson('/api/app/addons/timesheets/install')->assertAccepted()->assertJsonPath('installed', false);
        $this->getJson('/api/app/timesheets')->assertForbidden();
        Sanctum::actingAs(User::where('is_super_admin', true)->firstOrFail(), ['platform']);
        $this->getJson('/api/platform/overview')->assertOk()->assertJsonPath('pending_addon_requests', 1);
        $this->getJson('/api/platform/tenants?pending=1')->assertOk()->assertJsonPath('data.0.id', $this->tenant()->id);
        $this->approveAddon('timesheets');
        $this->getJson('/api/app/timesheets')->assertOk();
        $this->getJson('/api/app/addons/timesheets')->assertJsonPath('pending', false)->assertJsonPath('installed', true);
    }

    public function test_free_addon_can_be_installed_without_approval(): void
    {
        Module::where('key', 'timesheets')->firstOrFail()->update(['price_monthly' => 0]);
        $this->actingAsOwner();
        $this->postJson('/api/app/addons/timesheets/install')->assertOk()->assertJsonPath('installed', true)->assertJsonPath('pending', false);
    }
}
