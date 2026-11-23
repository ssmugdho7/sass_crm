<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/** Removes a payment and recalculates the invoice's amount_paid / status. */
class DeletePayment
{
    public function __construct(private RefreshInvoiceStatus $refresh) {}

    public function __invoke(Payment $payment): Invoice
    {
        return DB::transaction(function () use ($payment) {
            $invoice = Invoice::withoutGlobalScope('tenant')->where('tenant_id', $payment->tenant_id)->findOrFail($payment->invoice_id);
            $payment->delete();

            return ($this->refresh)($invoice, -(int) $payment->amount);
        });
    }
}
