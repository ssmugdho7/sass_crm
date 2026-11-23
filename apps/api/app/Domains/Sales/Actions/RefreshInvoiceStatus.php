<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;

/** Applies a change to amount_paid (in cents, may be negative) and derives the payment status. */
class RefreshInvoiceStatus
{
    public function __invoke(Invoice $invoice, int $delta = 0): Invoice
    {
        $paid = max(0, (int) $invoice->amount_paid + $delta);
        $invoice->forceFill(['amount_paid' => $paid, 'status' => self::statusFor($invoice->status, $paid, (int) $invoice->total)])->save();

        return $invoice;
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
