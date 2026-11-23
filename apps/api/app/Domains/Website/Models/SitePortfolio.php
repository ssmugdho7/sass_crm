<?php

namespace App\Domains\Website\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SitePortfolio extends Model
{
    use BelongsToTenant;

    protected $table = 'site_portfolio';

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return ['images' => 'array', 'completed_on' => 'date:Y-m-d', 'project_id' => 'integer', 'sort' => 'integer', 'is_published' => 'boolean'];
    }
}
