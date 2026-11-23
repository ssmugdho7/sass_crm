<?php

namespace App\Domains\Identity;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class IdentityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Login attempts: per IP, per email+IP, and per email (slows credential stuffing across many IPs).
        RateLimiter::for('login', function (Request $request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(10)->by('ip:'.$request->ip()),
                Limit::perMinute(5)->by('email-ip:'.$email.'|'.$request->ip()),
                Limit::perMinute(20)->by('email:'.$email),
            ];
        });
    }
}
