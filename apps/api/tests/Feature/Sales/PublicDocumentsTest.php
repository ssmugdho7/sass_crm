<?php

namespace Tests\Feature\Sales;

use App\Models\TenantModule;
use App\Support\Tenancy\CurrentTenant;

class PublicDocumentsTest extends SalesTestCase
{
    private function create(string $type, string $status = 'sent'): array
    {
        $owner = $this->actingAsOwner();

        $doc = $this->postJson("/api/app/{$type}", [
            'customer_id' => $this->customerFor($owner->tenant)->id,
            'items' => [['description' => 'Siding', 'quantity' => 2, 'unit_price' => 5000]],
        ])->assertCreated()->json();
        if ($status !== 'draft') {
            $this->postJson("/api/app/{$type}/{$doc['id']}/status", ['status' => $status])->assertOk();
        }

        return $doc;
    }

    private function asGuest(): void
    {
        CurrentTenant::set(null);
        $this->app['auth']->forgetGuards();
    }

    public function test_public_invoice_by_token_hides_internals(): void
    {
        $inv = $this->create('invoices');
        $this->asGuest();

        $res = $this->getJson("/api/public/invoices/{$inv['public_token']}")->assertOk()
            ->assertJsonPath('document.number', 'INV-0001')->assertJsonPath('document.total', 10000)
            ->assertJsonPath('business.name', 'Demo Builders')->assertJsonPath('customer.name', 'Jane Client')
            ->assertJsonPath('can_pay_online', false);
        $json = json_encode($res->json());
        $this->assertStringNotContainsString('tenant_id', $json);
        $this->assertStringNotContainsString('public_token', $json);
        $this->assertArrayNotHasKey('id', $res->json('document'));

        $this->getJson('/api/public/invoices/'.str_repeat('x', 40))->assertNotFound();
    }

    public function test_can_pay_online_requires_gateway_with_secret_key(): void
    {
        $inv = $this->create('invoices');
        $tenantId = $this->owner()->tenant_id;
        // Seeded demo tenant is on Growth plan → payment_gateway installed, but no keys yet.
        $row = TenantModule::withoutGlobalScope('tenant')->firstOrCreate(['tenant_id' => $tenantId, 'module_key' => 'payment_gateway']);
        $this->asGuest();
        $this->getJson("/api/public/invoices/{$inv['public_token']}")->assertJsonPath('can_pay_online', false);

        $row->forceFill(['status' => 'active', 'config' => ['secret_key' => 'sk_test_123']])->save();
        $this->getJson("/api/public/invoices/{$inv['public_token']}")->assertJsonPath('can_pay_online', true);

        $row->forceFill(['status' => 'disabled'])->save();
        $this->getJson("/api/public/invoices/{$inv['public_token']}")->assertJsonPath('can_pay_online', false);
    }

    public function test_public_estimate_accept_and_decline(): void
    {
        $a = $this->create('estimates');
        $b = $this->create('estimates');
        $this->asGuest();

        $this->getJson("/api/public/estimates/{$a['public_token']}")->assertOk()
            ->assertJsonPath('document.type', 'estimate')->assertJsonPath('document.status', 'sent');
        $this->postJson("/api/public/estimates/{$a['public_token']}/accept")->assertOk()->assertJsonPath('document.status', 'accepted');
        $this->postJson("/api/public/estimates/{$a['public_token']}/decline")->assertStatus(422);
        $this->postJson("/api/public/estimates/{$b['public_token']}/decline")->assertOk()->assertJsonPath('document.status', 'declined');
    }

    public function test_draft_documents_are_not_public(): void
    {
        $inv = $this->create('invoices', 'draft');
        $est = $this->create('estimates', 'draft');
        $this->asGuest();

        $this->getJson("/api/public/invoices/{$inv['public_token']}")->assertNotFound();
        $this->getJson("/api/public/estimates/{$est['public_token']}")->assertNotFound();
        $this->postJson("/api/public/estimates/{$est['public_token']}/accept")->assertNotFound();
    }
}
