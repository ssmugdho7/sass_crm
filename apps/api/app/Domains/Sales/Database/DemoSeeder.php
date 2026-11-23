<?php

namespace App\Domains\Sales\Database;

use App\Domains\Sales\Actions\CalculateTotals;
use App\Domains\Sales\Actions\RecordPayment;
use App\Models\Customer;
use App\Models\Estimate;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/** Idempotent demo estimates, invoices and payments for tenant demo-builders. */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'demo-builders')->first();
        if (! $tenant) {
            return;
        }
        $customers = Customer::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->orderBy('id')->get();
        if ($customers->isEmpty()) {
            $c = new Customer(['name' => 'Harper Residence', 'email' => 'harper@example.test', 'phone' => '555-0142', 'address' => '18 Oak Lane', 'city' => 'Springfield']);
            $c->tenant_id = $tenant->id;
            $c->save();
            $customers = collect([$c]);
        }
        $customerAt = fn (int $i) => $customers[$i % $customers->count()];
        $projectFor = fn (Customer $c) => Project::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->where('customer_id', $c->id)->value('id');
        $totals = new CalculateTotals;

        $estimates = [
            ['EST-0001', 'accepted', 0, 8.25, [['Kitchen demolition & haul-away', 1, 180000], ['Custom cabinets (linear ft)', 22, 35000], ['Quartz countertop install', 1, 420000]]],
            ['EST-0002', 'sent', 1, 8.25, [['Roof tear-off (squares)', 24, 9500], ['Architectural shingles (squares)', 24, 16500], ['Flashing & ridge vent', 1, 85000]]],
            ['EST-0003', 'draft', 2, 0, [['Deck framing (sq ft)', 320, 1800], ['Composite decking (sq ft)', 320, 2400], ['Railing (linear ft)', 60, 6500]]],
        ];
        foreach ($estimates as [$number, $status, $ci, $rate, $items]) {
            $customer = $customerAt($ci);
            $calc = $totals(array_map(fn ($i) => ['description' => $i[0], 'quantity' => $i[1], 'unit_price' => $i[2]], $items), $rate);
            $estimate = Estimate::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id, 'number' => $number]);
            if (! $estimate->exists) {
                $estimate->forceFill([
                    'tenant_id' => $tenant->id, 'customer_id' => $customer->id, 'project_id' => $projectFor($customer),
                    'status' => $status, 'issue_date' => now()->subDays(20), 'expiry_date' => now()->addDays(10),
                    'tax_rate' => $rate, 'notes' => 'Price valid for 30 days. Permits not included.', 'public_token' => Str::random(40),
                ] + $calc)->save();
            }
        }

        $accepted = Estimate::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->where('number', 'EST-0001')->first();
        $invoices = [
            // number, status, customer index, due in days, items, payments
            ['INV-0001', 'sent', 0, 15, $accepted?->items ?? [['description' => 'Kitchen remodel', 'quantity' => 1, 'unit_price' => 1500000]], [[500000, 'bank_transfer', 'Deposit']], $accepted?->id],
            ['INV-0002', 'sent', 1, -5, [['description' => 'Emergency roof repair', 'quantity' => 1, 'unit_price' => 245000], ['description' => 'Materials', 'quantity' => 1, 'unit_price' => 61000]], [], null],
            ['INV-0003', 'sent', 2, 10, [['description' => 'Bathroom tile work (sq ft)', 'quantity' => 85, 'unit_price' => 1400]], [[119000, 'check', 'CHK #1043']], null],
            ['INV-0004', 'draft', 0, 30, [['description' => 'Change order: extra outlets', 'quantity' => 6, 'unit_price' => 9500]], [], null],
        ];
        foreach ($invoices as [$number, $status, $ci, $dueIn, $items, $payments, $estimateId]) {
            $customer = $estimateId ? Customer::withoutGlobalScope('tenant')->find($accepted->customer_id) : $customerAt($ci);
            $rate = $estimateId ? (float) $accepted->tax_rate : 8.25;
            $invoice = Invoice::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id, 'number' => $number]);
            if ($invoice->exists) {
                continue;
            }
            $invoice->forceFill([
                'tenant_id' => $tenant->id, 'customer_id' => $customer->id, 'project_id' => $projectFor($customer), 'estimate_id' => $estimateId,
                'status' => $status, 'issue_date' => now()->subDays(25), 'due_date' => now()->addDays($dueIn), 'tax_rate' => $rate,
                'amount_paid' => 0, 'notes' => 'Thank you for your business!', 'public_token' => Str::random(40),
            ] + $totals($items, $rate))->save();
            foreach ($payments as [$amount, $method, $ref]) {
                if (! Payment::withoutGlobalScope('tenant')->where('invoice_id', $invoice->id)->where('reference', $ref)->exists()) {
                    app(RecordPayment::class)($invoice, min($amount, (int) $invoice->total), $method, $ref);
                }
            }
        }
    }
}
