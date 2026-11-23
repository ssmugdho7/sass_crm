<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;
use Illuminate\Support\Facades\DB;

/**
 * Applies a change to amount_paid (in cents, may be negative) and derives the payment status.
 * The invoice row is re-read under lockForUpdate so concurrent payments never work from a stale amount_paid;
 * the passed model is synced with the stored result.
 */
class RefreshInvoiceStatus
{
    public function __invoke(Invoice $invoice, int $delta = 0): Invoice
    {
        return DB::transaction(function () use ($invoice, $delta) {
            $locked = self::lock($invoice);
            $paid = max(0, (int) $locked->amount_paid + $delta);
            $locked->forceFill(['amount_paid' => $paid, 'status' => self::statusFor($locked->status, $paid, (int) $locked->total)])->save();

            $invoice->forceFill($locked->only(['amount_paid', 'status', 'total', 'updated_at']))->syncOriginal();

            return $invoice;
        });
    }

    /** Re-reads the invoice row with a write lock (works without a current tenant, e.g. the Stripe webhook). */
    public static function lock(Invoice $invoice): Invoice
    {
        return Invoice::withoutGlobalScope('tenant')->where('tenant_id', $invoice->tenant_id)
            ->lockForUpdate()->findOrFail($invoice->id);
    }

    public static function statusFor(string $current, int $paid, int $total): string
    {
        if ($current === 'void') {
            return 'void';
        }
        if ($paid > 0 && $paid >= $total) {
            return 'paid';
        }
        if ($paid > 0) {
            return 'partial';
        }

        // No money in: fall back from payment-derived states to "sent".
        return in_array($current, ['paid', 'partial'], true) ? 'sent' : $current;
    }
}
