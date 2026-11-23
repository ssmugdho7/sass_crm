<?php

namespace App\Domains\Integrations\Listeners;

use App\Domains\Integrations\Models\CalendarEventLink;
use App\Domains\Integrations\Services\GoogleCalendarClient;
use App\Events\AppointmentSaved;
use App\Models\Tenant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Mirrors appointments into the tenant's Google Calendar. Never throws: failures are logged. */
class SyncAppointmentToGoogle
{
    public function handle(AppointmentSaved $event): void
    {
        try {
            $this->sync($event);
        } catch (Throwable $e) {
            Log::warning('Google Calendar sync failed', [
                'tenant_id' => $event->tenantId, 'appointment_id' => $event->appointmentId, 'error' => $e->getMessage(),
            ]);
        }
    }

    private function sync(AppointmentSaved $event): void
    {
        $tenant = Tenant::find($event->tenantId);
        $client = $tenant ? GoogleCalendarClient::forTenant($tenant) : null;
        if (! $client) {
            return;
        }

        $link = CalendarEventLink::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenant->id)->where('appointment_id', $event->appointmentId)->first();
        $appointment = $event->deleted ? null : DB::table('appointments')
            ->where('tenant_id', $tenant->id)->where('id', $event->appointmentId)->first();

        if (! $appointment || $appointment->status === 'cancelled') {
            if ($link) {
                $client->deleteEvent($link->google_event_id);
                $link->delete();
            }

            return;
        }

        $body = $this->eventBody($appointment);
        if ($link) {
            $res = $client->updateEvent($link->google_event_id, $body);
            if ($res->successful()) {
                return;
            }
            if (! in_array($res->status(), [404, 410], true)) {
                $res->throw();
            }
            // Event was removed in Google: recreate it below.
            $link->delete();
        }

        $id = $client->createEvent($body);
        $link = new CalendarEventLink;
        $link->forceFill(['tenant_id' => $tenant->id, 'appointment_id' => $appointment->id, 'google_event_id' => $id])->save();
    }

    private function eventBody(object $a): array
    {
        $start = CarbonImmutable::parse($a->starts_at);
        $end = $a->ends_at ? CarbonImmutable::parse($a->ends_at) : $start->addHour();
        if ($end->lte($start)) {
            $end = $start->addHour();
        }

        return array_filter([
            'summary' => $a->title ?: 'Appointment',
            'location' => $a->location ?? null,
            'description' => $a->notes ?? null,
            'start' => ['dateTime' => $start->toRfc3339String()],
            'end' => ['dateTime' => $end->toRfc3339String()],
        ], fn ($v) => $v !== null && $v !== '');
    }
}
