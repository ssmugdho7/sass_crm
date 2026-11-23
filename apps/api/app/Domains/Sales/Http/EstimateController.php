<?php

namespace App\Domains\Sales\Http;

use App\Domains\Sales\Actions\CalculateTotals;
use App\Domains\Sales\Actions\ConvertEstimateToInvoice;
use App\Domains\Sales\Actions\NextDocumentNumber;
use App\Domains\Sales\Support\DocumentPresenter;
use App\Http\Controllers\Controller;
use App\Models\Estimate;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EstimateController extends Controller
{
    public const STATUSES = ['draft', 'sent', 'accepted', 'declined'];

    public function index(Request $request)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(self::STATUSES)], 'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'], 'q' => ['nullable', 'string', 'max:100'],
        ]);

        return Estimate::with('customer:id,name', 'project:id,name')
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($data['customer_id'] ?? null, fn ($q, $c) => $q->where('customer_id', $c))
            ->when($data['project_id'] ?? null, fn ($q, $p) => $q->where('project_id', $p))
            ->when($data['q'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w->where('number', 'like', "%{$s}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$s}%"))))
            ->latest('id')->paginate(25);
    }

    public function store(Request $request, CalculateTotals $totals, NextDocumentNumber $number)
    {
        $data = $request->validate(DocumentRules::for(true, 'expiry_date'));
        $estimate = DB::transaction(fn () => Estimate::create([
            ...$this->fill($data, $totals),
            'number' => $number(Estimate::class, 'EST', CurrentTenant::id()), 'status' => 'draft',
            'issue_date' => $data['issue_date'] ?? now()->toDateString(),
            'expiry_date' => array_key_exists('expiry_date', $data) ? $data['expiry_date'] : now()->addDays(30)->toDateString(),
            'public_token' => Str::random(40),
        ]));

        return response()->json($this->present($estimate), 201);
    }

    public function show(string $estimateId)
    {
        $estimate = Estimate::findOrFail($estimateId);

        return $this->present($estimate);
    }

    public function update(Request $request, string $estimateId, CalculateTotals $totals)
    {
        $estimate = Estimate::findOrFail($estimateId);
        $data = $request->validate(DocumentRules::for(false, 'expiry_date'));
        $estimate->update($this->fill($data, $totals, $estimate));

        return $this->present($estimate);
    }

    public function status(Request $request, string $estimateId)
    {
        $estimate = Estimate::findOrFail($estimateId);
        $data = $request->validate(['status' => ['required', Rule::in(self::STATUSES)]]);
        $estimate->update($data);

        return $this->present($estimate);
    }

    public function convert(string $estimateId, ConvertEstimateToInvoice $convert)
    {
        $estimate = Estimate::findOrFail($estimateId);
        abort_if($estimate->status === 'declined', 422, 'A declined estimate cannot be converted.');
        $invoice = $convert($estimate);

        return response()->json(DocumentPresenter::invoice($invoice->load('customer:id,name')), 201);
    }

    public function destroy(string $estimateId)
    {
        $estimate = Estimate::findOrFail($estimateId);
        $estimate->delete();

        return response()->noContent();
    }

    private function fill(array $data, CalculateTotals $totals, ?Estimate $existing = null): array
    {
        $fields = collect($data)->only(['customer_id', 'project_id', 'issue_date', 'expiry_date', 'notes'])->all();
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

    private function present(Estimate $estimate): array
    {
        $estimate->load('customer:id,name,email,phone,address,city', 'project:id,name');

        return $estimate->toArray() + [
            'invoice_id' => DB::table('invoices')->where('tenant_id', $estimate->tenant_id)->where('estimate_id', $estimate->id)->value('id'),
        ];
    }
}
