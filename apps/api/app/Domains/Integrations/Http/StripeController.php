<?php

namespace App\Domains\Integrations\Http;

use App\Domains\Integrations\Services\StripeSignature;
use App\Domains\Integrations\Services\StripeWebhookKey;
use App\Domains\Integrations\Services\TenantModuleConfig;
use App\Domains\Sales\Actions\RecordPayment;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class StripeController extends Controller
{
    public function checkout(string $token): JsonResponse
    {
        $invoice = Invoice::withoutGlobalScope('tenant')->where('public_token', $token)->first();
        $tenant = $invoice ? Tenant::find($invoice->tenant_id) : null;
        // Suspended/cancelled/expired-trial accounts look exactly like an unknown token.
        abort_if(! $tenant || ! $tenant->isAccessible(), 404, 'Invoice not found.');
        $config = TenantModuleConfig::for($tenant, 'payment_gateway');
        $secret = (string) ($config['secret_key'] ?? '');
        if ($secret === '') {
            return $this->fail('Online payment is not available for this invoice.');
        }
        $balance = (int) $invoice->total - (int) $invoice->amount_paid;
        if (in_array($invoice->status, ['draft', 'void'], true)) {
            return $this->fail('This invoice is not open for payment.');
        }
        if ($balance <= 0 || $invoice->status === 'paid') {
            return $this->fail('This invoice has nothing left to pay.');
        }

        $page = TenantModuleConfig::frontend('/i/invoice/'.$invoice->public_token);
        try {
            $res = Http::asForm()->withToken($secret)->timeout(20)->post('https://api.stripe.com/v1/checkout/sessions', [
                'mode' => 'payment',
                'line_items[0][quantity]' => 1,
                'line_items[0][price_data][currency]' => strtolower((string) ($config['currency'] ?? '') ?: 'usd'),
                'line_items[0][price_data][unit_amount]' => $balance,
                'line_items[0][price_data][product_data][name]' => 'Invoice '.$invoice->number,
                'metadata[invoice_id]' => $invoice->id,
                'metadata[tenant_id]' => $invoice->tenant_id,
                'success_url' => $page.'?paid=1',
                'cancel_url' => $page,
            ]);
        } catch (Throwable $e) {
            Log::warning('Stripe checkout failed', ['invoice' => $invoice->id, 'error' => $e->getMessage()]);

            return $this->fail('Could not reach the payment provider. Please try again.');
        }
        if (! $res->successful() || ! $res->json('url')) {
            Log::warning('Stripe checkout rejected', ['invoice' => $invoice->id, 'status' => $res->status(), 'error' => $res->json('error.message')]);

            return $this->fail('The payment provider rejected the request. Please contact the business.');
        }

        return response()->json(['url' => $res->json('url')]);
    }

    /** GET /app/integrations/stripe/webhook-url — the endpoint to paste into the Stripe dashboard. */
    public function webhookUrl(): JsonResponse
    {
        return response()->json(['url' => StripeWebhookKey::url(StripeWebhookKey::ensure(CurrentTenant::get()))]);
    }

    public function webhook(Request $request, string $webhookKey, RecordPayment $record): JsonResponse
    {
        $tenant = StripeWebhookKey::tenant($webhookKey);
        if (! $tenant) {
            // Deprecated: slug-based URL from before webhook keys. Breaks if the tenant renames its slug.
            $tenant = Tenant::where('slug', $webhookKey)->first();
        }
        $config = $tenant ? TenantModuleConfig::for($tenant, 'payment_gateway') : null;
        $payload = $request->getContent();
        if (! $config || ! StripeSignature::verify($payload, $request->header('Stripe-Signature'), (string) ($config['webhook_secret'] ?? ''))) {
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        $event = json_decode($payload, true) ?: [];
        $session = $event['data']['object'] ?? [];
        if (($event['type'] ?? null) === 'checkout.session.completed' && ($session['payment_status'] ?? null) === 'paid') {
            $invoice = Invoice::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)
                ->find($session['metadata']['invoice_id'] ?? 0);
            $reference = (string) ($session['id'] ?? '');
            $expected = strtolower((string) ($config['currency'] ?? '') ?: 'usd');
            $currency = strtolower((string) ($session['currency'] ?? $expected));
            if ($currency !== $expected) {
                Log::warning('Stripe session currency mismatch ignored', ['tenant' => $tenant->id, 'session' => $reference, 'currency' => $currency, 'expected' => $expected]);
            } elseif ($invoice && $invoice->status === 'void') {
                Log::warning('Stripe payment for void invoice ignored', ['tenant' => $tenant->id, 'invoice' => $invoice->id, 'session' => $reference]);
            } elseif ($invoice && $reference !== '') {
                // Clamped to the balance under the invoice row lock; repeated deliveries dedupe on the session id.
                $record($invoice, (int) ($session['amount_total'] ?? 0), 'stripe', $reference, capToBalance: true);
            }
        }

        return response()->json(['received' => true]);
    }

    private function fail(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }
}
