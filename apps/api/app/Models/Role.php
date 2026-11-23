<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['permissions' => 'array', 'is_system' => 'boolean'];
    }

    public function allows(string $permission): bool
    {
        $perms = $this->permissions ?? [];

        return in_array('*', $perms, true) || in_array($permission, $perms, true);
    }
}
