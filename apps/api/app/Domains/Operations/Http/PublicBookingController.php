<?php

namespace App\Domains\Operations\Http;

use App\Domains\Operations\Models\Appointment;
use App\Events\AppointmentSaved;
use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PublicBookingController extends Controller
{
    /** Public website booking form → Lead (source website) + requested Appointment. */
    public function store(Request $request, string $slug)
    {
        $tenant = Tenant::where('slug', $slug)->first();
        abort_unless($tenant && $tenant->isAccessible() && $tenant->hasModule('appointments'), 404);

        abort_unless(DB::table('site_settings')->where('tenant_id', $tenant->id)->where('published', true)->exists(), 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'service' => ['nullable', 'string', 'max:255'],
            'preferred_at' => ['required', 'date', 'after:now'],
            'message' => ['nullable', 'string', 'max:5000'],
        ]);
        $start = Carbon::parse($data['preferred_at']);

        $appt = DB::transaction(function () use ($tenant, $data, $start) {
            $lead = new Lead([
                'name' => $data['name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null,
                'service' => $data['service'] ?? null, 'message' => $data['message'] ?? null,
                'source' => 'website', 'status' => 'new',
            ]);
            $lead->tenant_id = $tenant->id;
            $lead->save();

            $appt = new Appointment([
                'title' => trim(($data['service'] ?? 'Consultation').' — '.$data['name']),
                'starts_at' => $start, 'ends_at' => $start->copy()->addHour(),
                'notes' => $data['message'] ?? null, 'status' => 'requested', 'source' => 'website',
                'lead_id' => $lead->id, 'contact_name' => $data['name'],
                'contact_email' => $data['email'], 'contact_phone' => $data['phone'] ?? null,
            ]);
            $appt->tenant_id = $tenant->id;
            $appt->save();

            return $appt;
        });

        AppointmentSaved::dispatch($tenant->id, $appt->id, false);

        return response()->json(['message' => 'Thanks! We received your request and will confirm shortly.'], 201);
    }
}
