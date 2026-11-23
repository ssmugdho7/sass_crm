<?php

namespace App\Domains\Integrations\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CalendarEventLink extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id'];
}
