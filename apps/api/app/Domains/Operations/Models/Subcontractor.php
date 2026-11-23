<?php

namespace App\Domains\Operations\Models;

use App\Models\Project;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Subcontractor extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id', 'tenant_id'];

    protected $appends = ['insurance_expiring', 'insurance_expired'];

    protected function casts(): array
    {
        return ['insurance_expiry' => 'date:Y-m-d', 'rate' => 'integer'];
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'subcontractor_project')->withPivot(['id', 'scope', 'agreed_amount'])->withTimestamps();
    }

    /** Insurance expires within the next 30 days (and has not expired yet). */
    public function getInsuranceExpiringAttribute(): bool
    {
        return $this->insurance_expiry !== null
            && $this->insurance_expiry->greaterThanOrEqualTo(today())
            && $this->insurance_expiry->lessThanOrEqualTo(today()->addDays(30));
    }

    public function getInsuranceExpiredAttribute(): bool
    {
        return $this->insurance_expiry !== null && $this->insurance_expiry->lessThan(today());
    }
}
