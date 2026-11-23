<?php

namespace App\Domains\Website\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SiteService extends Model
{
    use BelongsToTenant;

    protected $table = 'site_services';

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return ['price_from' => 'integer', 'sort' => 'integer', 'is_published' => 'boolean'];
    }
}
