<?php

namespace Tests\Feature\Subscriptions;

use App\Models\Module;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModuleCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_platform_deactivated_addon_is_revoked_for_installed_tenants(): void
    {
        $tenant = Tenant::where('slug', 'demo-builders')->firstOrFail();
        $this->assertTrue($tenant->hasModule('appointments'));

        Module::find('appointments')->update(['is_active' => false]);
        $this->assertFalse($tenant->forgetModules()->hasModule('appointments'));
    }
}
