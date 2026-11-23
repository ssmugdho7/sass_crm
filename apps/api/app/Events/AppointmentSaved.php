<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

/** Fired by Operations whenever an appointment is created/updated/deleted. Addons (Google Calendar) listens. */
class AppointmentSaved
{
    use Dispatchable;

    public function __construct(public int $tenantId, public int $appointmentId, public bool $deleted = false) {}
}
