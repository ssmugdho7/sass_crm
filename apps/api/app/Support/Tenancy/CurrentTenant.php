<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;

class CurrentTenant
{
    private static ?Tenant $tenant = null;

    public static function set(?Tenant $tenant): void
    {
        self::$tenant = $tenant;
    }

    public static function get(): ?Tenant
    {
        return self::$tenant;
    }

    public static function id(): ?int
    {
        return self::$tenant?->id;
    }
}
