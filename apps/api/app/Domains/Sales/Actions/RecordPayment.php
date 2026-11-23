<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/** The only way to record money against an invoice (manual entry, Stripe webhook, ...). Updates amount_paid + status. */
class RecordPayment
{
    public function __construct(private RefreshInvoiceStatus $refresh) {}

    public function __invoke(Invoice $invoice, int $amount, string $method, ?string $reference = null): Payment
    {
        return DB::transaction(function () use ($invoice, $amount, $method, $reference) {
            $payment = new Payment(['invoice_id' => $invoice->id, 'amount' => $amount, 'method' => $method, 'reference' => $reference, 'paid_at' => now()]);
            $payment->tenant_id = $invoice->tenant_id;
            $payment->save();
            ($this->refresh)($invoice, $amount);

            return $payment;
        });
    }
}
