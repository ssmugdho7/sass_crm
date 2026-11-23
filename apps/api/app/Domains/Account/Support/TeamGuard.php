<?php

namespace App\Domains\Account\Support;

use App\Models\Role;
use App\Models\User;

/**
 * Privilege-escalation rules for team and role management. Only full-access
 * users ('*') may touch full-access users/roles, and nobody may grant
 * permissions they don't hold themselves.
 */
class TeamGuard
{
    public static function isFull(User $user): bool
    {
        return in_array('*', $user->permissionList(), true);
    }

    public static function grantsFull(?array $permissions): bool
    {
        return in_array('*', $permissions ?? [], true);
    }

    /** Abort 403 unless $actor holds every permission in $permissions. */
    public static function ensureCanGrant(User $actor, ?array $permissions): void
    {
        if (self::isFull($actor)) {
            return;
        }
        abort_if(self::grantsFull($permissions), 403, 'Only users with full access can grant full access.');
        $missing = array_filter($permissions ?? [], fn ($p) => ! $actor->hasPermission($p));
        abort_if($missing !== [], 403, 'You cannot grant permissions you do not hold: '.implode(', ', $missing));
    }

    /**
     * Abort 403 if $actor may not manage $target. Managing another user (credentials, status, deletion)
     * effectively grants their access, so the actor must hold every permission on the target's role.
     */
    public static function ensureCanManageUser(User $actor, User $target): void
    {
        if (self::isFull($actor) || $actor->id === $target->id) {
            return;
        }
        abort_if(self::isFull($target), 403, 'Only users with full access can manage this user.');
        $missing = array_filter($target->role?->permissions ?? [], fn ($p) => ! $actor->hasPermission($p));
        abort_if($missing !== [], 403, 'You cannot manage a user who has permissions you do not hold: '.implode(', ', $missing));
    }

    /** Abort 403 if $actor may not assign $role. */
    public static function ensureCanAssignRole(User $actor, Role $role): void
    {
        self::ensureCanGrant($actor, $role->permissions);
    }

    /** Abort 403 if $actor may not edit/delete $role. */
    public static function ensureCanEditRole(User $actor, Role $role): void
    {
        if (self::isFull($actor)) {
            return;
        }
        abort_if($actor->role_id === $role->id, 403, 'You cannot edit your own role.');
        abort_if(self::grantsFull($role->permissions), 403, 'Only users with full access can edit this role.');
    }
}
