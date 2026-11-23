<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class TenantModule extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id'];

    protected $hidden = ['config'];

    protected function casts(): array
    {
        return ['config' => 'encrypted:array'];
    }
}
