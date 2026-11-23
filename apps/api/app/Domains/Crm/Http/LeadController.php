<?php

namespace App\Domains\Crm\Http;

use App\Domains\Crm\Actions\ConvertLead;
use App\Models\Lead;
use Illuminate\Http\Request;

class LeadController
{
    use TenantRules;

    public const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

    public const SOURCES = ['manual', 'website', 'referral', 'phone', 'social'];

    public function index(Request $request)
    {
        return Lead::with('assignee:id,name')
            ->when($request->string('search')->toString(), fn ($q, $s) => $q->where(fn ($q) => $q
                ->where('name', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")->orWhere('company', 'like', "%{$s}%")
                ->orWhere('service', 'like', "%{$s}%")))
            ->when($request->string('status')->toString(), fn ($q, $s) => $q->where('status', $s))
            ->when($request->string('source')->toString(), fn ($q, $s) => $q->where('source', $s))
            ->latest('id')->paginate($this->perPage($request));
    }

    public function show(int $leadId)
    {
        $lead = Lead::findOrFail($leadId);

        return $lead->load('assignee:id,name', 'customer:id,name');
    }

    public function store(Request $request)
    {
        return response()->json(Lead::create($this->validated($request))->refresh()->load('assignee:id,name'), 201);
    }

    public function update(Request $request, int $leadId)
    {
        $lead = Lead::findOrFail($leadId);
        $lead->update($this->validated($request));

        return $lead->load('assignee:id,name');
    }

    public function destroy(int $leadId)
    {
        $lead = Lead::findOrFail($leadId);
        $lead->delete();

        return response()->noContent();
    }

    public function convert(Request $request, int $leadId, ConvertLead $convert)
    {
        $lead = Lead::findOrFail($leadId);
        $data = $request->validate(['create_project' => 'sometimes|boolean']);

        return response()->json($convert($lead, (bool) ($data['create_project'] ?? false)), 201);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'nullable|email|max:190',
            'phone' => 'nullable|string|max:40',
            'company' => 'nullable|string|max:120',
            'service' => 'nullable|string|max:120',
            'source' => 'sometimes|in:'.implode(',', self::SOURCES),
            'status' => 'sometimes|in:'.implode(',', self::STATUSES),
            'value' => 'nullable|integer|min:0',
            'address' => 'nullable|string|max:255',
            'message' => 'nullable|string|max:5000',
            'assigned_to' => ['nullable', 'integer', $this->inTenant('users')],
        ]);
        $data['value'] = (int) ($data['value'] ?? 0);

        return $data;
    }
}
