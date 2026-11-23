<?php

namespace Tests\Feature\Sales;

use App\Domains\Sales\Actions\DeletePayment;
use App\Domains\Sales\Actions\NextDocumentNumber;
use App\Domains\Sales\Actions\RecordPayment;
use App\Domains\Sales\Database\DemoSeeder;
use App\Models\Estimate;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class ConcurrencyTest extends SalesTestCase
{
    private function invoice(int $total = 100000, int $paid = 0): Invoice
    {
        $owner = $this->owner();

        return Invoice::withoutGlobalScope('tenant')->forceCreate([
            'tenant_id' => $owner->tenant_id, 'customer_id' => $this->customerFor($owner->tenant)->id, 'number' => 'INV-9'.uniqid(),
            'status' => 'sent', 'issue_date' => now()->toDateString(), 'items' => [], 'total' => $total, 'amount_paid' => $paid,
            'public_token' => 'tok_'.uniqid(),
        ]);
    }

    public function test_sequence_continues_from_existing_numbers_and_never_repeats(): void
    {
        $other = $this->otherOwner();
        $next = app(NextDocumentNumber::class);

        // A fresh tenant starts at 0001 and counts up.
        $this->assertSame('EST-0001', $next(Estimate::class, 'EST', $other->tenant_id));
        $this->assertSame('EST-0002', $next(Estimate::class, 'EST', $other->tenant_id));
        $this->assertSame('INV-0001', $next(Invoice::class, 'INV', $other->tenant_id));

        // Two allocations before either document is inserted (the old max()-based race) stay distinct.
        $a = $next(Invoice::class, 'INV', $other->tenant_id);
        $b = $next(Invoice::class, 'INV', $other->tenant_id);
        $this->assertNotSame($a, $b);
        $this->assertSame(['INV-0002', 'INV-0003'], [$a, $b]);
    }

    public function test_sequence_initialises_from_current_max(): void
    {
        // The demo tenant has INV-0001..0004 but no counter row yet (e.g. data that predates document_sequences).
        $this->seed(DemoSeeder::class);
        DB::table('document_sequences')->where('tenant_id', $this->owner()->tenant_id)->delete();
        $this->assertSame('INV-0005', app(NextDocumentNumber::class)(Invoice::class, 'INV', $this->owner()->tenant_id));
    }

    public function test_duplicate_reference_is_recorded_once(): void
    {
        $invoice = $this->invoice(50000, 10000);
        $record = app(RecordPayment::class);

        $first = $record($invoice, 40000, 'stripe', 'cs_dup');
        $second = $record(Invoice::withoutGlobalScope('tenant')->find($invoice->id), 40000, 'stripe', 'cs_dup');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Payment::withoutGlobalScope('tenant')->where('reference', 'cs_dup')->count());
        $invoice->refresh();
        $this->assertSame(50000, (int) $invoice->amount_paid);
        $this->assertSame('paid', $invoice->status);
    }

    public function test_unique_index_rejects_duplicate_reference_and_allows_null(): void
    {
        $invoice = $this->invoice();
        $record = app(RecordPayment::class);
        $record($invoice, 100, 'cash');
        $record($invoice, 100, 'cash');
        $record($invoice, 100, 'check', 'CHK-1');
        $this->assertSame(3, Payment::withoutGlobalScope('tenant')->where('invoice_id', $invoice->id)->count());

        $this->expectException(UniqueConstraintViolationException::class);
        Payment::withoutGlobalScope('tenant')->forceCreate([
            'tenant_id' => $invoice->tenant_id, 'invoice_id' => $invoice->id, 'amount' => 1, 'method' => 'check', 'reference' => 'CHK-1', 'paid_at' => now(),
        ]);
    }

    public function test_stale_invoice_model_does_not_lose_payments(): void
    {
        $invoice = $this->invoice();
        $stale = Invoice::withoutGlobalScope('tenant')->find($invoice->id); // loaded before any payment
        $record = app(RecordPayment::class);

        $p1 = $record($invoice, 30000, 'cash');
        $record($stale, 20000, 'cash'); // stale amount_paid = 0 in memory
        $this->assertSame(50000, (int) $invoice->fresh()->amount_paid);
        $this->assertSame('partial', $invoice->fresh()->status);

        $deleted = app(DeletePayment::class)($p1);
        $this->assertSame(20000, (int) $deleted->amount_paid);
        // Deleting the same payment again (double click / concurrent request) must not subtract twice.
        app(DeletePayment::class)($p1);
        $this->assertSame(20000, (int) $invoice->fresh()->amount_paid);
    }
}
