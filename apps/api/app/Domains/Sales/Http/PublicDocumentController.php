<?php

namespace App\Domains\Sales\Http;

use App\Domains\Sales\Support\DocumentPresenter;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Estimate;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\TenantModule;
use Illuminate\Database\Eloquent\Model;

/** Client-facing invoice/estimate views by public token. Never exposes ids or tenant internals. */
class PublicDocumentController extends Controller
{
    public function invoice(string $token)
    {
        $invoice = $this->find(Invoice::class, $token);
        $tenant = $this->tenant($invoice);

        return [
            'document' => DocumentPresenter::publicDocument($invoice),
            'business' => $this->business($tenant), 'customer' => $this->customer($invoice),
            'can_pay_online' => $invoice->status !== 'void' && DocumentPresenter::balance($invoice) > 0 && $this->canPayOnline($tenant),
        ];
    }

    public function estimate(string $token)
    {
        $estimate = $this->find(Estimate::class, $token);

        return $this->estimatePayload($estimate);
    }

    public function accept(string $token)
    {
        return $this->respond($token, 'accepted');
    }

    public function decline(string $token)
    {
        return $this->respond($token, 'declined');
    }

    private function respond(string $token, string $status)
    {
        $estimate = $this->find(Estimate::class, $token);
        abort_unless(in_array($estimate->status, ['draft', 'sent'], true), 422, 'This estimate has already been '.$estimate->status.'.');
        $estimate->forceFill(['status' => $status])->save();

        return $this->estimatePayload($estimate);
    }

    private function estimatePayload(Estimate $estimate): array
    {
        return [
            'document' => DocumentPresenter::publicDocument($estimate),
            'business' => $this->business($this->tenant($estimate)), 'customer' => $this->customer($estimate),
            'can_pay_online' => false,
        ];
    }

    /** @template T of Model @param class-string<T> $model @return T */
    private function find(string $model, string $token): Model
    {
        abort_if(strlen($token) < 20, 404);
        $doc = $model::withoutGlobalScope('tenant')->where('public_token', $token)->first();
        // Drafts are unpublished: they look exactly like an unknown token.
        abort_if(! $doc || $doc->status === 'draft', 404, 'Document not found.');
        abort_unless($this->tenant($doc)->isAccessible(), 404, 'Document not found.');
        $doc->setRelation('project', $doc->project()->withoutGlobalScope('tenant')->where('tenant_id', $doc->tenant_id)->first());

        return $doc;
    }

    private function tenant(Model $doc): Tenant
    {
        return $doc->relationLoaded('tenant') ? $doc->tenant : $doc->setRelation('tenant', Tenant::findOrFail($doc->tenant_id))->tenant;
    }

    private function business(Tenant $tenant): array
    {
        return ['name' => $tenant->name, 'email' => $tenant->email, 'phone' => $tenant->phone, 'slug' => $tenant->slug];
    }

    private function customer(Invoice|Estimate $doc): ?array
    {
        $c = Customer::withoutGlobalScope('tenant')->where('tenant_id', $doc->tenant_id)->find($doc->customer_id);

        return $c ? ['name' => $c->name, 'email' => $c->email, 'phone' => $c->phone, 'address' => $c->address, 'city' => $c->city] : null;
    }

    private function canPayOnline(Tenant $tenant): bool
    {
        if (! $tenant->hasModule('payment_gateway')) {
            return false;
        }
        $row = TenantModule::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->where('module_key', 'payment_gateway')->first();

        return trim((string) ($row?->config['secret_key'] ?? '')) !== '';
    }
}
