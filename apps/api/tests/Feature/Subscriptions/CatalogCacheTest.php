<?php

namespace Tests\Feature\Subscriptions;

use App\Models\Module;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CatalogCacheTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_catalog_survives_a_serializing_cache_store(): void
    {
        config(['cache.default' => 'file', 'cache.stores.file.path' => storage_path('framework/cache/test-'.uniqid())]);
        Cache::forget('modules.catalog');

        $first = Module::catalog();
        $second = Module::catalog();

        $this->assertSame($first->keys()->all(), $second->keys()->all());
        $this->assertInstanceOf(Module::class, $second->get('appointments'));
        $this->assertTrue($second->get('appointments')->is_active);

        $this->postJson('/api/auth/login', ['email' => 'owner@demo.test', 'password' => 'password'])->assertOk();
        Cache::forget('modules.catalog');
    }
}
