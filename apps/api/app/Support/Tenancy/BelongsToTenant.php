<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Every tenant-owned model uses this trait. Reads are filtered to the current tenant
 * and tenant_id is stamped on create. Super-admin code uses withoutGlobalScope('tenant') explicitly.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        // Fail closed: with no current tenant the scope matches nothing. Platform, public,
        // queued and console code must opt out explicitly with withoutGlobalScope('tenant').
        static::addGlobalScope('tenant', function (Builder $query) {
            $id = CurrentTenant::id();
            $id ? $query->where($query->getModel()->getTable().'.tenant_id', $id) : $query->whereRaw('1 = 0');
        });

        static::creating(function ($model) {
            if (! $model->tenant_id && ($id = CurrentTenant::id())) {
                $model->tenant_id = $id;
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
