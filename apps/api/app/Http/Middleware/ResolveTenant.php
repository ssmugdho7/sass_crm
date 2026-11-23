<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;

class ResolveTenant
{
    /**
     * `tenant` requires an accessible subscription. `tenant:billing` (only the billing page and plan
     * change request) also lets suspended/past-due/expired-trial tenants in so the owner can recover;
     * cancelled accounts and disabled users stay blocked.
     */
    public function handle(Request $request, Closure $next, ?string $mode = null)
    {
        $user = $request->user();
        abort_if(! $user || ! $user->tenant_id, 403, 'Not a CRM account.');
        abort_if($user->status !== 'active', 403, 'Your account is disabled.');
        $tenant = $user->tenant;
        if ($mode === 'billing') {
            abort_if($tenant->status === 'cancelled', 402, 'This account has been cancelled. Contact support.');
        } else {
            abort_if(! $tenant->isAccessible(), 402, 'Subscription inactive. Choose a plan on the billing page to reactivate.');
        }
        CurrentTenant::set($tenant->forgetModules());
        try {
            return $next($request);
        } finally {
            CurrentTenant::set(null);
        }
    }
}
