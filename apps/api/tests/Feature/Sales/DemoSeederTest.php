<?php

namespace Tests\Feature\Sales;

use App\Domains\Sales\Database\DemoSeeder;
use App\Models\Estimate;
use App\Models\Invoice;
use App\Models\Payment;

class DemoSeederTest extends SalesTestCase
{
    public function test_demo_seeder_is_idempotent(): void
    {
        $this->seed(DemoSeeder::class);
        $this->seed(DemoSeeder::class);
        $tenantId = $this->owner()->tenant_id;

        $this->assertSame(3, Estimate::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)->count());
        $this->assertSame(4, Invoice::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)->count());
        $this->assertSame(2, Payment::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)->count());
        $inv = Invoice::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)->where('number', 'INV-0001')->first();
        $this->assertSame('partial', $inv->status);
        $this->assertSame(500000, $inv->amount_paid);
    }
}
