<?php

use App\Domains\Integrations\Http\GoogleCalendarController;
use App\Domains\Integrations\Http\StripeController;
use Illuminate\Support\Facades\Route;

Route::prefix('public')->group(function () {
    Route::post('invoices/{token}/checkout', [StripeController::class, 'checkout'])->middleware('throttle:20,1');
    Route::post('stripe/webhook/{tenantSlug}', [StripeController::class, 'webhook'])->middleware('throttle:120,1');
    Route::get('google/callback', [GoogleCalendarController::class, 'callback'])->middleware('throttle:30,1');
});

Route::middleware(['auth:sanctum', 'tenant', 'module:google_calendar', 'perm:calendar.manage'])
    ->prefix('app/integrations/google')->group(function () {
        Route::get('connect', [GoogleCalendarController::class, 'connect']);
        Route::get('status', [GoogleCalendarController::class, 'status']);
        Route::delete('disconnect', [GoogleCalendarController::class, 'disconnect']);
    });
