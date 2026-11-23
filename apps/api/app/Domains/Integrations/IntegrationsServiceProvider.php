<?php

namespace App\Domains\Integrations;

use App\Domains\Integrations\Listeners\SyncAppointmentToGoogle;
use App\Events\AppointmentSaved;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class IntegrationsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(AppointmentSaved::class, SyncAppointmentToGoogle::class);
    }
}
