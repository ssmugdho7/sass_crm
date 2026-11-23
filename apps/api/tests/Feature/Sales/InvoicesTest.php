<?php

namespace Tests\Feature\Sales;

class InvoicesTest extends SalesTestCase
{
    private function invoice(array $extra = []): array
    {
        $owner = $this->actingAsOwner();

        return $this->postJson('/api/app/invoices', $extra + [
            'customer_id' => $this->customerFor($owner->tenant)->id,
            'items' => [['description' => 'Concrete slab', 'quantity' => 1, 'unit_price' => 100000]], 'tax_rate' => 0,
        ])->assertCreated()->json();
    }

    public function test_create_invoice_numbers_and_computes(): void
    {
        $inv = $this->invoice(['tax_rate' => 5]);
        $this->assertSame('INV-0001', $inv['number']);
        $this->assertSame(105000, $inv['total']);
        $this->assertSame(105000, $inv['balance']);
        $this->assertFalse($inv['is_overdue']);
        $this->postJson('/api/app/invoices', ['customer_id' => $inv['customer_id'], 'items' => $inv['items']])
            ->assertJsonPath('number', 'INV-0002');
    }

    public function test_partial_then_paid_and_balance_cap(): void
    {
        $inv = $this->invoice();
        $url = "/api/app/invoices/{$inv['id']}/payments";

        $this->postJson($url, ['amount' => 40000, 'method' => 'cash'])->assertCreated()
            ->assertJsonPath('invoice.status', 'partial')->assertJsonPath('invoice.amount_paid', 40000)->assertJsonPath('invoice.balance', 60000);
        $this->postJson($url, ['amount' => 60001, 'method' => 'check'])->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->postJson($url, ['amount' => 100, 'method' => 'bitcoin'])->assertStatus(422)->assertJsonValidationErrors('method');
        $this->postJson($url, ['amount' => 60000, 'method' => 'bank_transfer', 'reference' => 'TX-1'])->assertCreated()
            ->assertJsonPath('invoice.status', 'paid')->assertJsonPath('invoice.balance', 0);
        $this->postJson($url, ['amount' => 1, 'method' => 'cash'])->assertStatus(422);

        $this->getJson($url)->assertOk()->assertJsonCount(2);
    }

    public function test_delete_payment_recalculates(): void
    {
        $inv = $this->invoice();
        $url = "/api/app/invoices/{$inv['id']}/payments";
        $p1 = $this->postJson($url, ['amount' => 30000, 'method' => 'cash'])->json('payment.id');
        $p2 = $this->postJson($url, ['amount' => 70000, 'method' => 'card'])->assertJsonPath('invoice.status', 'paid')->json('payment.id');

        $this->deleteJson("{$url}/{$p2}")->assertOk()->assertJsonPath('invoice.status', 'partial')->assertJsonPath('invoice.amount_paid', 30000);
        $this->deleteJson("{$url}/{$p1}")->assertOk()->assertJsonPath('invoice.status', 'sent')->assertJsonPath('invoice.amount_paid', 0);
    }

    public function test_overdue_flag_and_filter(): void
    {
        $inv = $this->invoice(['due_date' => now()->subDay()->toDateString()]);
        $this->assertTrue($inv['is_overdue']);
        $this->invoice(['due_date' => now()->addDays(5)->toDateString()]);

        $this->getJson('/api/app/invoices?status=overdue')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $inv['id']);
        $this->postJson("/api/app/invoices/{$inv['id']}/status", ['status' => 'void'])->assertJsonPath('is_overdue', false);
        $this->getJson('/api/app/invoices?status=overdue')->assertJsonCount(0, 'data');
    }

    public function test_invoices_and_payments_isolated(): void
    {
        $inv = $this->invoice();
        $pid = $this->postJson("/api/app/invoices/{$inv['id']}/payments", ['amount' => 100, 'method' => 'cash'])->json('payment.id');

        $this->actingAsOwner($this->otherOwner());
        $this->getJson("/api/app/invoices/{$inv['id']}")->assertNotFound();
        $this->getJson("/api/app/invoices/{$inv['id']}/payments")->assertNotFound();
        $this->postJson("/api/app/invoices/{$inv['id']}/payments", ['amount' => 100, 'method' => 'cash'])->assertNotFound();
        $this->deleteJson("/api/app/invoices/{$inv['id']}/payments/{$pid}")->assertNotFound();
        $this->getJson('/api/app/invoices')->assertJsonCount(0, 'data');
    }

    public function test_requires_auth(): void
    {
        $this->getJson('/api/app/invoices')->assertUnauthorized();
    }
}
