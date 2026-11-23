<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['trial_ends_at' => 'datetime', 'current_period_end' => 'datetime'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function modules(): HasMany
    {
        return $this->hasMany(TenantModule::class)->withoutGlobalScope('tenant');
    }

    /** Keys of every module this tenant can use: core + active installed add-ons. */
    public function enabledModuleKeys(): array
    {
        $core = collect(config('crm_modules'))->filter(fn ($m) => $m['core'])->keys();
        $installed = $this->modules()->where('status', 'active')->pluck('module_key');

        return $core->merge($installed)->unique()->values()->all();
    }

    public function hasModule(string $key): bool
    {
        return in_array($key, $this->enabledModuleKeys(), true);
    }

    public function isAccessible(): bool
    {
        return ! in_array($this->status, ['suspended', 'cancelled'], true);
    }
}
