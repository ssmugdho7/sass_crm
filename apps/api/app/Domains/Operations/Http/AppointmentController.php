<?php

namespace App\Domains\Operations\Http;

use App\Domains\Operations\Models\Appointment;
use App\Domains\Operations\Support\TenantRules;
use App\Events\AppointmentSaved;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AppointmentController extends Controller
{
    private const WITH = ['customer:id,name', 'lead:id,name', 'project:id,name', 'assignee:id,name'];

    public function index(Request $request)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'], 'to' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(Appointment::STATUSES)], 'source' => ['nullable', 'in:manual,website'],
        ]);
        $q = Appointment::with(self::WITH)->orderBy('starts_at');
        if ($data['from'] ?? null) {
            $q->where('ends_at', '>=', $data['from']);
        }
        if ($data['to'] ?? null) {
            $q->where('starts_at', '<=', $data['to']);
        }
        foreach (['status', 'source'] as $f) {
            if ($data[$f] ?? null) {
                $q->where($f, $data[$f]);
            }
        }

        // Calendar ranges return everything in range; otherwise paginate.
        return ($data['from'] ?? null) && ($data['to'] ?? null) ? ['data' => $q->limit(500)->get()] : $q->paginate(25);
    }

    public function show(int $appointment)
    {
        return Appointment::with(self::WITH)->findOrFail($appointment);
    }

    public function store(Request $request)
    {
        $appt = Appointment::create($this->validated($request) + ['source' => 'manual']);
        AppointmentSaved::dispatch($appt->tenant_id, $appt->id, false);

        return response()->json($appt->load(self::WITH), 201);
    }

    public function update(Request $request, int $appointment)
    {
        $appt = Appointment::findOrFail($appointment);
        $appt->update($this->validated($request, true));
        AppointmentSaved::dispatch($appt->tenant_id, $appt->id, false);

        return $appt->load(self::WITH);
    }

    public function destroy(int $appointment)
    {
        $appt = Appointment::findOrFail($appointment);
        $tenantId = $appt->tenant_id;
        $id = $appt->id;
        $appt->delete();
        AppointmentSaved::dispatch($tenantId, $id, true);

        return response()->noContent();
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'title' => [$req, 'string', 'max:255'],
            'starts_at' => [$req, 'date'],
            'ends_at' => [$req, 'date', 'after_or_equal:starts_at'],
            'location' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(Appointment::STATUSES)],
            'customer_id' => ['nullable', 'integer', TenantRules::exists('customers')],
            'lead_id' => ['nullable', 'integer', TenantRules::exists('leads')],
            'project_id' => ['nullable', 'integer', TenantRules::exists('projects')],
            'assigned_to' => ['nullable', 'integer', TenantRules::exists('users')],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
        ]);
    }
}
