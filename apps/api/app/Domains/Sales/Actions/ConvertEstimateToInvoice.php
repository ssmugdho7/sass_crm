<?php

namespace App\Domains\Sales\Actions;

use App\Models\Estimate;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Creates a draft invoice from an estimate (items, tax and totals copied). */
class ConvertEstimateToInvoice
{
    public function __construct(private NextDocumentNumber $number) {}

    public function __invoke(Estimate $estimate): Invoice
    {
        return DB::transaction(function () use ($estimate) {
            $invoice = new Invoice([
                'customer_id' => $estimate->customer_id, 'project_id' => $estimate->project_id, 'estimate_id' => $estimate->id,
                'number' => ($this->number)(Invoice::class, 'INV', $estimate->tenant_id), 'status' => 'draft',
                'issue_date' => now()->toDateString(), 'due_date' => now()->addDays(30)->toDateString(),
                'items' => $estimate->items, 'tax_rate' => $estimate->tax_rate, 'subtotal' => $estimate->subtotal,
                'tax' => $estimate->tax, 'total' => $estimate->total, 'amount_paid' => 0, 'notes' => $estimate->notes,
                'public_token' => Str::random(40),
            ]);
            $invoice->tenant_id = $estimate->tenant_id;
            $invoice->save();
            if (in_array($estimate->status, ['draft', 'sent'], true)) {
                $estimate->update(['status' => 'accepted']);
            }

            return $invoice;
        });
    }
}
