<?php

namespace App\Domains\Website\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    use BelongsToTenant;

    protected $table = 'site_settings';

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return ['published' => 'boolean', 'service_areas' => 'array', 'social' => 'array', 'years_in_business' => 'integer'];
    }
}
