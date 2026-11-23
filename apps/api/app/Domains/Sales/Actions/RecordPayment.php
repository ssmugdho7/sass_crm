<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The only way to record money against an invoice (manual entry, Stripe webhook, ...). Updates amount_paid + status.
 * Stripe payments are idempotent per (tenant, session id) via payments.external_ref: a repeated delivery returns the
 * first payment. Manual references are free text and never dedupe (the same check number may pay two invoices).
 */
class RecordPayment
{
    /** Methods whose reference is a provider-issued, globally unique id. */
    public const EXTERNAL_METHODS = ['stripe'];

    public function __construct(private RefreshInvoiceStatus $refresh) {}

    /**
     * With $capToBalance the amount is clamped to the balance read under the row lock; returns null (records
     * nothing) when nothing is owed or the invoice is void.
     */
    public function __invoke(Invoice $invoice, int $amount, string $method, ?string $reference = null, bool $capToBalance = false, bool $rejectOverpayment = false): ?Payment
    {
        $externalRef = in_array($method, self::EXTERNAL_METHODS, true) && $reference !== null && $reference !== '' ? $reference : null;

        return DB::transaction(function () use ($invoice, $amount, $method, $reference, $externalRef, $capToBalance, $rejectOverpayment) {
            // Serialises concurrent payments on this invoice; amount_paid is then updated from the locked row.
            $locked = RefreshInvoiceStatus::lock($invoice);
            if ($externalRef !== null && ($existing = $this->existing($invoice, $externalRef))) {
                return $existing;
            }
            if ($rejectOverpayment) {
                abort_if($locked->status === 'void', 422, 'Cannot record a payment on a void invoice.');
                if ($amount > (int) $locked->total - (int) $locked->amount_paid) {
                    throw ValidationException::withMessages(['amount' => 'The amount cannot exceed the balance due.']);
                }
            }
            if ($capToBalance) {
                $amount = min($amount, (int) $locked->total - (int) $locked->amount_paid);
                if ($amount <= 0 || $locked->status === 'void') {
                    return null;
                }
            }

            $payment = new Payment(['invoice_id' => $invoice->id, 'amount' => $amount, 'method' => $method, 'reference' => $reference, 'paid_at' => now()]);
            $payment->tenant_id = $invoice->tenant_id;
            $payment->external_ref = $externalRef;
            try {
                // Savepoint, so a duplicate-reference violation doesn't abort the outer transaction (Postgres).
                DB::transaction(fn () => $payment->save());
            } catch (UniqueConstraintViolationException $e) {
                if ($externalRef === null || ! ($existing = $this->existing($invoice, $externalRef))) {
                    throw $e;
                }

                return $existing;
            }
            ($this->refresh)($invoice, $amount);

            return $payment;
        });
    }

    private function existing(Invoice $invoice, string $externalRef): ?Payment
    {
        return Payment::withoutGlobalScope('tenant')->where('tenant_id', $invoice->tenant_id)
            ->where('external_ref', $externalRef)->first();
    }
}
