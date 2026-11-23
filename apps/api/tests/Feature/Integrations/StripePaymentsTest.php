<?php

namespace Tests\Feature\Integrations;

use App\Domains\Integrations\Services\StripeSignature;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StripePaymentsTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::where('slug', 'demo-builders')->firstOrFail();
    }

    private function configure(array $config): void
    {
        TenantModule::withoutGlobalScope('tenant')->updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'module_key' => 'payment_gateway'],
            ['status' => 'active', 'config' => $config],
        );
    }

    private function invoice(array $attrs = []): Invoice
    {
        $customer = Customer::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $this->tenant->id, 'name' => 'Pat Client']);

        return Invoice::withoutGlobalScope('tenant')->forceCreate(array_merge([
            'tenant_id' => $this->tenant->id, 'customer_id' => $customer->id, 'number' => 'INV-1001', 'status' => 'sent',
            'issue_date' => now()->toDateString(), 'items' => [['description' => 'Deck', 'quantity' => 1, 'unit_price' => 50000]],
            'total' => 50000, 'amount_paid' => 10000, 'public_token' => 'tok_'.uniqid(),
        ], $attrs));
    }

    public function test_checkout_creates_stripe_session_for_balance(): void
    {
        $this->configure(['secret_key' => 'sk_test_123', 'webhook_secret' => 'whsec_1', 'currency' => 'EUR']);
        $invoice = $this->invoice();
        Http::fake(['api.stripe.com/*' => Http::response(['id' => 'cs_1', 'url' => 'https://checkout.stripe.com/pay/cs_1'])]);

        $this->postJson("/api/public/invoices/{$invoice->public_token}/checkout")
            ->assertOk()->assertJsonPath('url', 'https://checkout.stripe.com/pay/cs_1');

        Http::assertSent(function (Request $r) use ($invoice) {
            return $r->url() === 'https://api.stripe.com/v1/checkout/sessions'
                && $r->hasHeader('Authorization', 'Bearer sk_test_123')
                && $r['mode'] === 'payment'
                && (int) $r['line_items[0][price_data][unit_amount]'] === 40000
                && $r['line_items[0][price_data][currency]'] === 'eur'
                && $r['line_items[0][price_data][product_data][name]'] === 'Invoice INV-1001'
                && (int) $r['metadata[invoice_id]'] === $invoice->id
                && str_ends_with($r['success_url'], "/i/invoice/{$invoice->public_token}?paid=1");
        });
    }

    public function test_checkout_returns_404_when_tenant_not_accessible(): void
    {
        $this->configure(['secret_key' => 'sk_test_123']);
        $invoice = $this->invoice();
        Http::fake();

        $this->tenant->forceFill(['status' => 'suspended'])->save();
        $this->postJson("/api/public/invoices/{$invoice->public_token}/checkout")->assertNotFound();

        $this->tenant->forceFill(['status' => 'trial', 'trial_ends_at' => now()->subDay()])->save();
        $this->postJson("/api/public/invoices/{$invoice->public_token}/checkout")->assertNotFound();

        $this->postJson('/api/public/invoices/tok_unknown/checkout')->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_checkout_refuses_when_not_configured_or_nothing_due(): void
    {
        Http::fake();
        $invoice = $this->invoice();
        $this->postJson("/api/public/invoices/{$invoice->public_token}/checkout")->assertStatus(422);

        $this->configure(['secret_key' => 'sk_test_123']);
        $paid = $this->invoice(['number' => 'INV-1002', 'amount_paid' => 50000, 'status' => 'paid']);
        $this->postJson("/api/public/invoices/{$paid->public_token}/checkout")->assertStatus(422);
        $this->postJson('/api/public/invoices/nope/checkout')->assertNotFound();

        Http::assertNothingSent();
    }

    public function test_webhook_records_payment_once(): void
    {
        $this->configure(['secret_key' => 'sk_test_123', 'webhook_secret' => 'whsec_abc']);
        $invoice = $this->invoice();
        $payload = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => [
            'id' => 'cs_test_99', 'payment_status' => 'paid', 'amount_total' => 40000,
            'metadata' => ['invoice_id' => (string) $invoice->id, 'tenant_id' => (string) $this->tenant->id],
        ]]]);
        $headers = ['Stripe-Signature' => StripeSignature::header($payload, 'whsec_abc'), 'Content-Type' => 'application/json'];

        foreach ([1, 2] as $_) {
            $this->call('POST', '/api/public/stripe/webhook/demo-builders', [], [], [], $this->transformHeadersToServerVars($headers), $payload)
                ->assertOk()->assertJsonPath('received', true);
        }

        $payments = Payment::withoutGlobalScope('tenant')->where('reference', 'cs_test_99')->get();
        $this->assertCount(1, $payments);
        $this->assertSame('stripe', $payments[0]->method);
        $invoice->refresh();
        $this->assertSame(50000, (int) $invoice->amount_paid);
        $this->assertSame('paid', $invoice->status);
    }

    public function test_webhook_rejects_bad_signature(): void
    {
        $this->configure(['secret_key' => 'sk_test_123', 'webhook_secret' => 'whsec_abc']);
        $payload = json_encode(['type' => 'checkout.session.completed']);
        $send = fn (string $sig) => $this->call('POST', '/api/public/stripe/webhook/demo-builders', [], [], [],
            $this->transformHeadersToServerVars(['Stripe-Signature' => $sig]), $payload);

        $send(StripeSignature::header($payload, 'wrong_secret'))->assertStatus(400);
        $send(StripeSignature::header($payload, 'whsec_abc', time() - 1000))->assertStatus(400);
        $send('garbage')->assertStatus(400);
    }

    public function test_webhook_caps_amount_at_balance_and_ignores_other_currency(): void
    {
        $this->configure(['secret_key' => 'sk_test_123', 'webhook_secret' => 'whsec_abc', 'currency' => 'EUR']);
        $invoice = $this->invoice(); // total 50000, paid 10000 → 40000 due
        $send = function (array $session) use ($invoice) {
            $payload = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => $session + [
                'payment_status' => 'paid', 'metadata' => ['invoice_id' => (string) $invoice->id],
            ]]]);
            $headers = ['Stripe-Signature' => StripeSignature::header($payload, 'whsec_abc'), 'Content-Type' => 'application/json'];
            $this->call('POST', '/api/public/stripe/webhook/demo-builders', [], [], [], $this->transformHeadersToServerVars($headers), $payload)->assertOk();
        };

        $send(['id' => 'cs_usd', 'amount_total' => 40000, 'currency' => 'usd']);
        $this->assertSame(0, Payment::withoutGlobalScope('tenant')->where('reference', 'cs_usd')->count());

        $send(['id' => 'cs_over', 'amount_total' => 90000, 'currency' => 'eur']);
        $this->assertSame(40000, (int) Payment::withoutGlobalScope('tenant')->where('reference', 'cs_over')->value('amount'));
        $this->assertSame(50000, (int) $invoice->refresh()->amount_paid);

        $send(['id' => 'cs_late', 'amount_total' => 5000, 'currency' => 'eur']); // nothing left to pay
        $this->assertSame(0, Payment::withoutGlobalScope('tenant')->where('reference', 'cs_late')->count());
    }

    private function paidEvent(Invoice $invoice, string $id): string
    {
        return json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => [
            'id' => $id, 'payment_status' => 'paid', 'amount_total' => 40000,
            'metadata' => ['invoice_id' => (string) $invoice->id],
        ]]]);
    }

    public function test_webhook_url_endpoint_generates_stable_key_and_keyed_route_works(): void
    {
        $this->configure(['secret_key' => 'sk_test_123', 'webhook_secret' => 'whsec_abc']);
        $owner = User::where('email', 'owner@demo.test')->firstOrFail();
        Sanctum::actingAs($owner);

        $url = $this->getJson('/api/app/integrations/stripe/webhook-url')->assertOk()->json('url');
        $this->assertMatchesRegularExpression('#/api/public/stripe/webhook/[A-Za-z0-9]{40}$#', $url);
        $this->assertSame($url, $this->getJson('/api/app/integrations/stripe/webhook-url')->json('url'));
        $key = substr($url, strrpos($url, '/') + 1);

        $row = TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant->id)->where('module_key', 'payment_gateway')->first();
        $this->assertSame($key, $row->webhook_key);
        $this->assertSame($key, $row->config['webhook_key']);
        $this->assertSame('whsec_abc', $row->config['webhook_secret']); // existing config preserved

        // Key keeps working after the tenant changes its slug.
        $this->tenant->forceFill(['slug' => 'renamed-builders'])->save();
        $invoice = $this->invoice();
        $payload = $this->paidEvent($invoice, 'cs_keyed');
        $headers = $this->transformHeadersToServerVars(['Stripe-Signature' => StripeSignature::header($payload, 'whsec_abc')]);
        $this->call('POST', "/api/public/stripe/webhook/{$key}", [], [], [], $headers, $payload)->assertOk();
        $this->assertSame(1, Payment::withoutGlobalScope('tenant')->where('reference', 'cs_keyed')->count());

        // Unknown key is rejected; legacy slug route still resolves the (new) slug.
        $this->call('POST', '/api/public/stripe/webhook/'.str_repeat('x', 40), [], [], [], $headers, $payload)->assertStatus(400);
        $this->call('POST', '/api/public/stripe/webhook/renamed-builders', [], [], [], $headers, $payload)->assertOk();
    }

    public function test_webhook_url_endpoint_requires_module_and_permission(): void
    {
        $owner = User::where('email', 'owner@demo.test')->firstOrFail();
        Sanctum::actingAs($owner);
        TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $this->tenant->id)->where('module_key', 'payment_gateway')->delete();
        $this->getJson('/api/app/integrations/stripe/webhook-url')->assertForbidden();

        $this->configure([]);
        $this->getJson('/api/app/integrations/stripe/webhook-url')->assertOk();

        $role = Role::create(['tenant_id' => $this->tenant->id, 'name' => 'Viewer', 'slug' => 'viewer-'.uniqid(), 'permissions' => ['invoices.view']]);
        $member = User::create(['tenant_id' => $this->tenant->id, 'role_id' => $role->id, 'name' => 'Vi', 'email' => 'vi@demo.test', 'password' => 'password', 'status' => 'active']);
        Sanctum::actingAs($member);
        $this->getJson('/api/app/integrations/stripe/webhook-url')->assertForbidden();
    }
}
