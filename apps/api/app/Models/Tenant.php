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
        return [
            'trial_ends_at' => 'datetime',
            'current_period_end' => 'datetime',
            'plan_requested_at' => 'datetime',
            'requested_plan_id' => 'integer',
        ];
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

    private ?array $enabledKeys = null;

    /** Keys of every module this tenant can use: core + installed add-ons the platform still offers. Memoised per instance. */
    public function enabledModuleKeys(): array
    {
        if ($this->enabledKeys !== null) {
            return $this->enabledKeys;
        }
        $catalog = collect(config('crm_modules'));
        $core = $catalog->filter(fn ($m) => $m['core'])->keys();
        $inactive = Module::catalog()->where('is_active', false)->keys()->all();
        $installed = $this->modules()->where('status', 'active')->pluck('module_key')
            ->filter(fn ($k) => $catalog->has($k) && ! in_array($k, $inactive, true));

        return $this->enabledKeys = $core->merge($installed)->unique()->values()->all();
    }

    /** Call after installing/uninstalling modules on an already-loaded tenant. */
    public function forgetModules(): static
    {
        $this->enabledKeys = null;

        return $this;
    }

    public function hasModule(string $key): bool
    {
        return in_array($key, $this->enabledModuleKeys(), true);
    }

    public function isAccessible(): bool
    {
        if (in_array($this->status, ['suspended', 'cancelled'], true)) {
            return false;
        }

        return ! ($this->status === 'trial' && $this->trial_ends_at?->isPast());
    }
}
