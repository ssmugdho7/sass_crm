<?php

namespace Tests\Feature\Marketing;

use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicPlansTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_lists_active_plans_in_sort_order_with_addon_catalog(): void
    {
        Plan::where('slug', 'pro')->update(['is_active' => false]);

        $res = $this->getJson('/api/public/plans')->assertOk();

        $this->assertSame(['starter', 'growth'], array_column($res->json('plans'), 'slug'));
        $res->assertJsonStructure([
            'plans' => [['id', 'name', 'slug', 'price_monthly', 'price_yearly', 'max_users', 'features', 'included_modules']],
            'addons' => [['key', 'name', 'description', 'price']],
        ]);
        $this->assertIsArray($res->json('plans.0.features'));

        $keys = array_column($res->json('addons'), 'key');
        $this->assertContains('payment_gateway', $keys);
        $this->assertNotContains('leads', $keys);
        $this->assertSame(1500, collect($res->json('addons'))->firstWhere('key', 'payment_gateway')['price']);
    }

    public function test_is_public(): void
    {
        $this->getJson('/api/public/plans')->assertOk()->assertJsonMissingPath('plans.0.is_active');
    }
}
