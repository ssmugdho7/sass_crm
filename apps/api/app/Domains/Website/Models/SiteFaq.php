<?php

namespace App\Domains\Website\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SiteFaq extends Model
{
    use BelongsToTenant;

    protected $table = 'site_faqs';

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return ['sort' => 'integer'];
    }
}
