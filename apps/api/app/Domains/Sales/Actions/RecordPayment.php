<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * The only way to record money against an invoice (manual entry, Stripe webhook, ...). Updates amount_paid + status.
 * Idempotent per (tenant, method, reference): recording the same non-null reference twice returns the first payment.
 */
class RecordPayment
{
    public function __construct(private RefreshInvoiceStatus $refresh) {}

    public function __invoke(Invoice $invoice, int $amount, string $method, ?string $reference = null): Payment
    {
        return DB::transaction(function () use ($invoice, $amount, $method, $reference) {
            // Serialises concurrent payments on this invoice; amount_paid is then updated from the locked row.
            RefreshInvoiceStatus::lock($invoice);
            if ($reference !== null && ($existing = $this->existing($invoice, $method, $reference))) {
                return $existing;
            }

            $payment = new Payment(['invoice_id' => $invoice->id, 'amount' => $amount, 'method' => $method, 'reference' => $reference, 'paid_at' => now()]);
            $payment->tenant_id = $invoice->tenant_id;
            try {
                // Savepoint, so a duplicate-reference violation doesn't abort the outer transaction (Postgres).
                DB::transaction(fn () => $payment->save());
            } catch (UniqueConstraintViolationException $e) {
                if ($reference === null || ! ($existing = $this->existing($invoice, $method, $reference))) {
                    throw $e;
                }

                return $existing;
            }
            ($this->refresh)($invoice, $amount);

            return $payment;
        });
    }

    private function existing(Invoice $invoice, string $method, string $reference): ?Payment
    {
        return Payment::withoutGlobalScope('tenant')->where('tenant_id', $invoice->tenant_id)
            ->where('method', $method)->where('reference', $reference)->first();
    }
}
