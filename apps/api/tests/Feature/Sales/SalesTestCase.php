<?php

namespace Tests\Feature\Sales;

use App\Domains\Identity\Actions\RegisterTenant;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

abstract class SalesTestCase extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    protected function owner(): User
    {
        return User::where('email', 'owner@demo.test')->firstOrFail();
    }

    protected function actingAsOwner(?User $user = null): User
    {
        $user ??= $this->owner();
        CurrentTenant::set(null);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function customerFor(Tenant $tenant, string $name = 'Jane Client'): Customer
    {
        $c = new Customer(['name' => $name, 'email' => 'jane@client.test', 'phone' => '555-1000', 'address' => '1 Main St']);
        $c->tenant_id = $tenant->id;
        $c->save();

        return $c;
    }

    protected function otherOwner(): User
    {
        return app(RegisterTenant::class)(['company' => 'Other Co', 'name' => 'Ozzy', 'email' => 'oz@other.test', 'password' => 'password', 'plan' => 'starter'])->fresh();
    }

    protected function items(): array
    {
        return [
            ['description' => 'Framing', 'quantity' => 3, 'unit_price' => 10050],
            ['description' => 'Drywall', 'quantity' => 1.5, 'unit_price' => 333],
        ];
    }
}
