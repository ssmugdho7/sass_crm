<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;

class ResolveTenant
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        abort_if(! $user || ! $user->tenant_id, 403, 'Not a CRM account.');
        abort_if($user->status !== 'active', 403, 'Your account is disabled.');
        $tenant = $user->tenant;
        abort_if(! $tenant->isAccessible(), 402, 'Subscription inactive. Contact support.');
        CurrentTenant::set($tenant);

        return $next($request);
    }
}
