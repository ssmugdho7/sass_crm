<?php

namespace App\Domains\Website\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SiteTestimonial extends Model
{
    use BelongsToTenant;

    protected $table = 'site_testimonials';

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return ['rating' => 'integer', 'sort' => 'integer', 'is_published' => 'boolean'];
    }
}
