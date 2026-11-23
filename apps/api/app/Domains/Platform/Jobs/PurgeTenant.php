<?php

namespace App\Domains\Platform\Jobs;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Permanently removes a cancelled tenant: revokes its Google OAuth grant
 * (best effort), deletes its uploaded website files, then deletes the tenant
 * row (all tenant-owned tables cascade via FK).
 */
class PurgeTenant implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $tenantId) {}

    public function handle(): void
    {
        $tenant = Tenant::query()->find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $this->revokeGoogleToken();
        Storage::disk('public')->deleteDirectory("sites/{$this->tenantId}");
        $tenant->delete();
    }

    private function revokeGoogleToken(): void
    {
        if (! Schema::hasTable('google_calendar_tokens')) {
            return;
        }

        try {
            $row = DB::table('google_calendar_tokens')->where('tenant_id', $this->tenantId)->first();
            $encrypted = $row?->refresh_token ?: $row?->access_token;
            if (! $encrypted) {
                return;
            }

            Http::asForm()->timeout(10)->post('https://oauth2.googleapis.com/revoke', [
                'token' => Crypt::decryptString($encrypted),
            ]);
        } catch (Throwable $e) {
            Log::warning('PurgeTenant: Google token revoke failed', ['tenant_id' => $this->tenantId, 'error' => $e->getMessage()]);
        }
    }
}
