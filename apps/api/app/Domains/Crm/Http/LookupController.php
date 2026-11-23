<?php

namespace App\Domains\Crm\Http;

use App\Models\User;
use App\Support\Tenancy\CurrentTenant;

class LookupController
{
    public function users()
    {
        return User::where('tenant_id', CurrentTenant::id())->where('status', 'active')
            ->orderBy('name')->get(['id', 'name']);
    }
}
