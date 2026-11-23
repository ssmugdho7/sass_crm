<?php

namespace App\Domains\Sales\Actions;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/** The only way to record money against an invoice (manual entry, Stripe webhook, ...). Updates amount_paid + status. */
class RecordPayment
{
    public function __invoke(Invoice $invoice, int $amount, string $method, ?string $reference = null): Payment
    {
        return DB::transaction(function () use ($invoice, $amount, $method, $reference) {
            $payment = Payment::withoutGlobalScope('tenant')->create([
                'tenant_id' => $invoice->tenant_id, 'invoice_id' => $invoice->id, 'amount' => $amount,
                'method' => $method, 'reference' => $reference, 'paid_at' => now(),
            ]);
            $paid = $invoice->amount_paid + $amount;
            $invoice->forceFill(['amount_paid' => $paid, 'status' => $paid >= $invoice->total ? 'paid' : 'partial'])->save();

            return $payment;
        });
    }
}
