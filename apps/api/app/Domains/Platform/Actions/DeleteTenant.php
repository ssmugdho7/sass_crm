<?php

namespace App\Domains\Platform\Actions;

use App\Domains\Platform\Jobs\PurgeTenant;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Schedules a tenant for deletion: locks everyone out immediately (status
 * 'cancelled' + all user tokens revoked) and queues the heavy purge.
 */
class DeleteTenant
{
    public function handle(Tenant $tenant): void
    {
        DB::transaction(function () use ($tenant) {
            $tenant->forceFill(['status' => 'cancelled'])->save();

            $userIds = User::query()->where('tenant_id', $tenant->id)->pluck('id');
            DB::table('personal_access_tokens')
                ->where('tokenable_type', (new User)->getMorphClass())
                ->whereIn('tokenable_id', $userIds)
                ->delete();
        });

        PurgeTenant::dispatch($tenant->id)->afterCommit();
    }
}
