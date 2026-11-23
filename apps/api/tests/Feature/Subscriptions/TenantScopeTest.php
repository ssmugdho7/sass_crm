<?php

namespace Tests\Feature\Subscriptions;

use App\Models\Lead;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantScopeTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_scope_fails_closed_without_a_current_tenant(): void
    {
        $tenant = Tenant::where('slug', 'demo-builders')->firstOrFail();
        $lead = new Lead(['name' => 'Scoped']);
        $lead->tenant_id = $tenant->id;
        $lead->save();

        CurrentTenant::set(null);
        $this->assertSame(0, Lead::count());
        $this->assertSame(1, Lead::withoutGlobalScope('tenant')->count());

        CurrentTenant::set($tenant);
        $this->assertSame(1, Lead::count());
        CurrentTenant::set(null);
    }
}
