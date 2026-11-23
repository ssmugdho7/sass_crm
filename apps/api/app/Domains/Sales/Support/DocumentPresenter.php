<?php

namespace App\Domains\Sales\Support;

use App\Models\Estimate;
use App\Models\Invoice;

/** Adds computed fields (balance, overdue flag) and builds the public, internals-free view of a document. */
class DocumentPresenter
{
    public static function isOverdue(Invoice $invoice): bool
    {
        return $invoice->status !== 'void' && self::balance($invoice) > 0
            && ($invoice->status === 'overdue' || ($invoice->due_date !== null && $invoice->due_date->lt(today())));
    }

    public static function balance(Invoice $invoice): int
    {
        return max(0, (int) $invoice->total - (int) $invoice->amount_paid);
    }

    /** Internal (tenant app) representation. */
    public static function invoice(Invoice $invoice): array
    {
        return $invoice->toArray() + ['balance' => self::balance($invoice), 'is_overdue' => self::isOverdue($invoice)];
    }

    /** Client-facing representation: no ids, tenant_id or timestamps. */
    public static function publicDocument(Invoice|Estimate $doc): array
    {
        $base = [
            'type' => $doc instanceof Invoice ? 'invoice' : 'estimate',
            'number' => $doc->number, 'status' => $doc->status,
            'issue_date' => $doc->issue_date?->toDateString(),
            'items' => collect($doc->items ?? [])->map(fn ($i) => [
                'description' => (string) ($i['description'] ?? ''), 'quantity' => $i['quantity'] ?? 0,
                'unit_price' => (int) ($i['unit_price'] ?? 0), 'amount' => (int) ($i['amount'] ?? 0),
            ])->values()->all(),
            'tax_rate' => (float) $doc->tax_rate, 'subtotal' => (int) $doc->subtotal, 'tax' => (int) $doc->tax,
            'total' => (int) $doc->total, 'notes' => $doc->notes, 'project' => $doc->project?->name,
            'site_address' => $doc->project?->site_address,
        ];

        return $doc instanceof Invoice
            ? $base + ['due_date' => $doc->due_date?->toDateString(), 'amount_paid' => (int) $doc->amount_paid,
                'balance' => self::balance($doc), 'is_overdue' => self::isOverdue($doc)]
            : $base + ['expiry_date' => $doc->expiry_date?->toDateString()];
    }
}
