<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Module extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_core' => 'boolean', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget('modules.catalog'));
        static::deleted(fn () => Cache::forget('modules.catalog'));
    }

    /** All catalog rows keyed by key, cached until a module row changes. */
    public static function catalog(): Collection
    {
        return Cache::rememberForever('modules.catalog', fn () => static::all()->keyBy('key'));
    }
}
