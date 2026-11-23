<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;

class RequireModule
{
    public function handle(Request $request, Closure $next, string $module)
    {
        abort_unless(CurrentTenant::get()?->hasModule($module), 403, "The {$module} add-on is not installed.");

        return $next($request);
    }
}
