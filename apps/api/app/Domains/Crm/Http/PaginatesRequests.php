<?php

namespace App\Domains\Crm\Http;

use Illuminate\Http\Request;

/** Page size helper for CRM list endpoints (?per_page=, clamped 1..100, default 25). */
trait PaginatesRequests
{
    protected function perPage(Request $request): int
    {
        return max(1, min(100, $request->integer('per_page', 25)));
    }
}
