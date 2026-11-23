<?php

namespace App\Domains\Sales\Http;

use App\Domains\Sales\Actions\CalculateTotals;
use App\Domains\Sales\Actions\NextDocumentNumber;
use App\Domains\Sales\Actions\RefreshInvoiceStatus;
use App\Domains\Sales\Support\DocumentPresenter;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    /** Filterable statuses; "overdue" is a derived filter, not a stored status. */
    public const STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

    /** Manually settable statuses. partial & paid derive from payments; overdue derives from due_date. */
    public const MANUAL_STATUSES = ['draft', 'sent', 'void'];

    public function index(Request $request)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(self::STATUSES)], 'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'], 'q' => ['nullable', 'string', 'max:100'],
        ]);

        return Invoice::with('customer:id,name', 'project:id,name')
            ->when($data['status'] ?? null, function ($q, $s) {
                // "overdue" is derived only: unpaid balance past its due date. It is never a stored status.
                $s === 'overdue'
                    ? $q->where('status', '!=', 'void')->whereColumn('amount_paid', '<', 'total')
                        ->whereDate('due_date', '<', today())
                    : $q->where('status', $s);
            })
            ->when($data['customer_id'] ?? null, fn ($q, $c) => $q->where('customer_id', $c))
            ->when($data['project_id'] ?? null, fn ($q, $p) => $q->where('project_id', $p))
            ->when($data['q'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w->where('number', 'like', "%{$s}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$s}%"))))
            ->latest('id')->paginate(25)
            ->through(fn (Invoice $i) => DocumentPresenter::invoice($i));
    }

    public function store(Request $request, CalculateTotals $totals, NextDocumentNumber $number)
    {
        $data = $request->validate(DocumentRules::for(true, 'due_date') + ['estimate_id' => ['nullable', 'integer',
            Rule::exists('estimates', 'id')->where('tenant_id', CurrentTenant::id())]]);
        $invoice = DB::transaction(fn () => Invoice::create([
            ...$this->fill($data, $totals),
            'estimate_id' => $data['estimate_id'] ?? null,
            'number' => $number(Invoice::class, 'INV', CurrentTenant::id()), 'status' => 'draft', 'amount_paid' => 0,
            'issue_date' => $data['issue_date'] ?? now()->toDateString(),
            'due_date' => array_key_exists('due_date', $data) ? $data['due_date'] : now()->addDays(30)->toDateString(),
            'public_token' => Str::random(40),
        ]));

        return response()->json($this->present($invoice), 201);
    }

    public function show(string $invoiceId)
    {
        $invoice = Invoice::findOrFail($invoiceId);

        return $this->present($invoice);
    }

    public function update(Request $request, string $invoiceId, CalculateTotals $totals, RefreshInvoiceStatus $refresh)
    {
        $invoice = Invoice::findOrFail($invoiceId);
        $data = $request->validate(DocumentRules::for(false, 'due_date'));
        $invoice->update($this->fill($data, $totals, $invoice));
        $refresh($invoice); // re-derive status after total change

        return $this->present($invoice);
    }

    /** Manual status: draft / sent / void. partial & paid derive from payments; overdue from due_date. */
    public function status(Request $request, string $invoiceId, RefreshInvoiceStatus $refresh)
    {
        $invoice = Invoice::findOrFail($invoiceId);
        $data = $request->validate(['status' => ['required', Rule::in(self::MANUAL_STATUSES)]]);
        $invoice->update($data);
        if ($data['status'] !== 'void') {
            $refresh($invoice); // re-derive status after total change
        }

        return $this->present($invoice);
    }

    public function destroy(string $invoiceId)
    {
        $invoice = Invoice::findOrFail($invoiceId);
        abort_if($invoice->payments()->exists(), 422, 'Delete the recorded payments first, or void the invoice instead.');
        $invoice->delete();

        return response()->noContent();
    }

    private function fill(array $data, CalculateTotals $totals, ?Invoice $existing = null): array
    {
        $fields = collect($data)->only(['customer_id', 'project_id', 'issue_date', 'due_date', 'notes'])->all();
        if (array_key_exists('issue_date', $fields) && ! $fields['issue_date']) {
            unset($fields['issue_date']);
        }
        if (array_key_exists('items', $data) || array_key_exists('tax_rate', $data)) {
            $rate = array_key_exists('tax_rate', $data) ? (float) ($data['tax_rate'] ?? 0) : (float) ($existing?->tax_rate ?? 0);
            $calc = $totals($data['items'] ?? $existing?->items ?? [], $rate);
            $fields += $calc + ['tax_rate' => $rate];
        }

        return $fields;
    }

    private function present(Invoice $invoice): array
    {
        $invoice->load('customer:id,name,email,phone,address,city', 'project:id,name');

        return DocumentPresenter::invoice($invoice);
    }
}
