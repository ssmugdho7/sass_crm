<?php

namespace Tests\Feature\Sales;

use App\Domains\Sales\Actions\CalculateTotals;

class EstimatesTest extends SalesTestCase
{
    public function test_totals_are_integer_cents_rounded_half_up(): void
    {
        // 3 × 100.50 = 30150; 1.5 × 3.33 = 499.5 → 500; subtotal 30650; 8.25% = 2528.625 → 2529
        $r = (new CalculateTotals)($this->items(), 8.25);
        $this->assertSame([30150, 500], array_column($r['items'], 'amount'));
        $this->assertSame(30650, $r['subtotal']);
        $this->assertSame(2529, $r['tax']);
        $this->assertSame(33179, $r['total']);
    }

    public function test_create_estimate_computes_totals_and_numbers_per_tenant(): void
    {
        $owner = $this->actingAsOwner();
        $customer = $this->customerFor($owner->tenant);

        $res = $this->postJson('/api/app/estimates', [
            'customer_id' => $customer->id, 'items' => $this->items(), 'tax_rate' => 8.25,
            'subtotal' => 1, 'total' => 1, // ignored: server computes
        ])->assertCreated()
            ->assertJsonPath('number', 'EST-0001')->assertJsonPath('status', 'draft')
            ->assertJsonPath('subtotal', 30650)->assertJsonPath('tax', 2529)->assertJsonPath('total', 33179);
        $this->assertSame(40, strlen($res->json('public_token')));

        $this->postJson('/api/app/estimates', ['customer_id' => $customer->id, 'items' => $this->items()])
            ->assertCreated()->assertJsonPath('number', 'EST-0002')->assertJsonPath('tax', 0);

        $other = $this->actingAsOwner($this->otherOwner());
        $this->postJson('/api/app/estimates', ['customer_id' => $this->customerFor($other->tenant)->id, 'items' => $this->items()])
            ->assertCreated()->assertJsonPath('number', 'EST-0001');
    }

    public function test_update_recalculates_and_status_changes(): void
    {
        $owner = $this->actingAsOwner();
        $id = $this->postJson('/api/app/estimates', ['customer_id' => $this->customerFor($owner->tenant)->id, 'items' => $this->items()])->json('id');

        $this->putJson("/api/app/estimates/{$id}", ['items' => [['description' => 'X', 'quantity' => 2, 'unit_price' => 1000]], 'tax_rate' => 10])
            ->assertOk()->assertJsonPath('subtotal', 2000)->assertJsonPath('tax', 200)->assertJsonPath('total', 2200);
        $this->postJson("/api/app/estimates/{$id}/status", ['status' => 'sent'])->assertOk()->assertJsonPath('status', 'sent');
        $this->postJson("/api/app/estimates/{$id}/status", ['status' => 'bogus'])->assertStatus(422);
    }

    public function test_convert_estimate_to_invoice(): void
    {
        $owner = $this->actingAsOwner();
        $est = $this->postJson('/api/app/estimates', ['customer_id' => $this->customerFor($owner->tenant)->id, 'items' => $this->items(), 'tax_rate' => 8.25])->json();

        $inv = $this->postJson("/api/app/estimates/{$est['id']}/convert")->assertCreated()
            ->assertJsonPath('number', 'INV-0001')->assertJsonPath('status', 'draft')
            ->assertJsonPath('estimate_id', $est['id'])->assertJsonPath('total', 33179)->assertJsonPath('balance', 33179)->json();
        // JSON object key order is not preserved by every database engine.
        $this->assertJsonStringEqualsJsonString(json_encode($est['items'], JSON_THROW_ON_ERROR), json_encode($inv['items'], JSON_THROW_ON_ERROR));
        $this->assertNotSame($est['public_token'], $inv['public_token']);
        $this->getJson("/api/app/estimates/{$est['id']}")->assertJsonPath('status', 'accepted')->assertJsonPath('invoice_id', $inv['id']);
    }

    public function test_customer_and_project_must_belong_to_tenant(): void
    {
        $other = $this->otherOwner();
        $foreign = $this->customerFor($other->tenant, 'Foreign');
        $this->actingAsOwner();

        $this->postJson('/api/app/estimates', ['customer_id' => $foreign->id, 'items' => $this->items()])
            ->assertStatus(422)->assertJsonValidationErrors('customer_id');
        $this->postJson('/api/app/invoices', ['customer_id' => $foreign->id, 'items' => $this->items()])
            ->assertStatus(422)->assertJsonValidationErrors('customer_id');
    }

    public function test_estimates_are_isolated_between_tenants(): void
    {
        $owner = $this->actingAsOwner();
        $id = $this->postJson('/api/app/estimates', ['customer_id' => $this->customerFor($owner->tenant)->id, 'items' => $this->items()])->json('id');

        $this->actingAsOwner($this->otherOwner());
        $this->getJson("/api/app/estimates/{$id}")->assertNotFound();
        $this->putJson("/api/app/estimates/{$id}", ['notes' => 'hack'])->assertNotFound();
        $this->postJson("/api/app/estimates/{$id}/convert")->assertNotFound();
        $this->getJson('/api/app/estimates')->assertOk()->assertJsonCount(0, 'data');
    }
}
