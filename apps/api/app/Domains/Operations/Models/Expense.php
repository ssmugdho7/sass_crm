<?php

namespace App\Domains\Operations\Models;

use App\Models\Project;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use BelongsToTenant;

    public const CATEGORIES = ['materials', 'labour', 'equipment', 'permits', 'subcontractor', 'other'];

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return ['expense_date' => 'date:Y-m-d', 'amount' => 'integer'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
