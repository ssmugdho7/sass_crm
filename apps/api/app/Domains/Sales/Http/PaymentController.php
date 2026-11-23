<?php

namespace App\Domains\Sales\Http;

use App\Domains\Sales\Actions\DeletePayment;
use App\Domains\Sales\Actions\RecordPayment;
use App\Domains\Sales\Support\DocumentPresenter;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function index(string $invoiceId)
    {
        $invoice = Invoice::findOrFail($invoiceId);

        return $invoice->payments()->latest('paid_at')->latest('id')->get();
    }

    public function store(Request $request, string $invoiceId, RecordPayment $record)
    {
        $invoice = Invoice::findOrFail($invoiceId);
        abort_if($invoice->status === 'void', 422, 'Cannot record a payment on a void invoice.');
        $balance = DocumentPresenter::balance($invoice);
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:'.max(1, $balance)],
            'method' => ['required', Rule::in(['cash', 'bank_transfer', 'check', 'card'])],
            'reference' => ['nullable', 'string', 'max:191'],
        ], ['amount.max' => 'The amount cannot exceed the balance due.']);
        abort_if($balance <= 0, 422, 'This invoice is already paid in full.');

        $payment = $record($invoice, (int) $data['amount'], $data['method'], $data['reference'] ?? null, rejectOverpayment: true);

        return response()->json(['payment' => $payment, 'invoice' => DocumentPresenter::invoice($invoice->refresh())], 201);
    }

    public function destroy(string $invoiceId, string $paymentId, DeletePayment $delete)
    {
        $invoice = Invoice::findOrFail($invoiceId);
        $payment = $invoice->payments()->findOrFail($paymentId);

        return ['invoice' => DocumentPresenter::invoice($delete($payment))];
    }
}
