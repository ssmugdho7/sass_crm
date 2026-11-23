<?php

namespace App\Domains\Integrations;

use App\Domains\Integrations\Listeners\SyncAppointmentToGoogle;
use App\Events\AppointmentSaved;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class IntegrationsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        if (! config('services.frontend_url')) {
            config(['services.frontend_url' => env('APP_FRONTEND_URL', 'http://127.0.0.1:3010')]);
        }
    }

    public function boot(): void
    {
        Event::listen(AppointmentSaved::class, SyncAppointmentToGoogle::class);
    }
}
