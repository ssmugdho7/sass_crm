<?php

namespace App\Domains\Crm\Http;

use App\Models\Customer;
use App\Models\Estimate;
use App\Models\Invoice;
use Illuminate\Http\Request;

class CustomerController
{
    use TenantRules;

    public function index(Request $request)
    {
        return Customer::withCount('projects')
            ->when($request->string('search')->toString(), fn ($q, $s) => $q->where(fn ($q) => $q
                ->where('name', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")->orWhere('city', 'like', "%{$s}%")))
            ->orderBy('name')->paginate($this->perPage($request));
    }

    public function show(int $customerId)
    {
        $customer = Customer::findOrFail($customerId);
        $invoices = $customer->invoices()->latest('issue_date')
            ->get(['id', 'number', 'status', 'issue_date', 'due_date', 'total', 'amount_paid']);

        return [
            'customer' => $customer,
            'projects' => $customer->projects()->latest('id')->get(['id', 'name', 'status', 'site_address', 'budget', 'start_date', 'due_date']),
            'invoices' => $invoices,
            'invoice_summary' => [
                'count' => $invoices->count(),
                'total' => (int) $invoices->where('status', '!=', 'void')->sum('total'),
                'paid' => (int) $invoices->where('status', '!=', 'void')->sum('amount_paid'),
                'outstanding' => (int) $invoices->whereNotIn('status', ['void', 'draft'])->sum(fn ($i) => max(0, $i->total - $i->amount_paid)),
            ],
        ];
    }

    public function store(Request $request)
    {
        return response()->json(Customer::create($this->validated($request))->refresh(), 201);
    }

    public function update(Request $request, int $customerId)
    {
        $customer = Customer::findOrFail($customerId);
        $customer->update($this->validated($request));

        return $customer;
    }

    public function destroy(int $customerId)
    {
        $customer = Customer::findOrFail($customerId);
        if (Invoice::where('customer_id', $customer->id)->exists() || Estimate::where('customer_id', $customer->id)->exists()) {
            return response()->json([
                'message' => 'This customer has estimates or invoices. Delete or reassign them first — customers with billing history cannot be deleted.',
            ], 422);
        }
        $customer->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'type' => 'sometimes|in:individual,company',
            'name' => 'required|string|max:120',
            'email' => 'nullable|email|max:190',
            'phone' => 'nullable|string|max:40',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:120',
            'notes' => 'nullable|string|max:5000',
        ]);
    }
}
