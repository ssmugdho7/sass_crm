<?php

namespace App\Domains\Integrations\Http;

use App\Domains\Integrations\Models\GoogleCalendarToken;
use App\Domains\Integrations\Services\GoogleCalendarClient;
use App\Domains\Integrations\Services\TenantModuleConfig;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class GoogleCalendarController extends Controller
{
    public function connect(Request $request): JsonResponse
    {
        $config = TenantModuleConfig::for(CurrentTenant::get(), 'google_calendar') ?? [];
        if (empty($config['client_id']) || empty($config['client_secret'])) {
            return response()->json(['message' => 'Add your Google client ID and client secret in the add-on settings first.'], 422);
        }
        $state = Crypt::encryptString(json_encode([
            'tenant_id' => CurrentTenant::id(), 'user_id' => $request->user()->id, 'exp' => now()->addMinutes(15)->timestamp,
        ]));

        return response()->json(['url' => GoogleCalendarClient::AUTH_URL.'?'.http_build_query([
            'client_id' => $config['client_id'],
            'redirect_uri' => GoogleCalendarClient::redirectUri(),
            'response_type' => 'code',
            'scope' => 'https://www.googleapis.com/auth/calendar.events openid email',
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986)]);
    }

    public function status(): JsonResponse
    {
        $token = GoogleCalendarToken::first();

        return response()->json(['connected' => (bool) $token, 'email' => $token?->email]);
    }

    public function disconnect(): JsonResponse
    {
        GoogleCalendarToken::query()->delete();

        return response()->json(['ok' => true]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $back = TenantModuleConfig::frontend('/app/addons/google_calendar');
        try {
            $state = json_decode(Crypt::decryptString((string) $request->query('state')), true);
            $tenant = Tenant::find($state['tenant_id'] ?? 0);
            $config = $tenant ? TenantModuleConfig::for($tenant, 'google_calendar') : null;
            if (! $tenant || ! $config || ($state['exp'] ?? 0) < time() || ! $request->filled('code')
                || empty($config['client_id']) || empty($config['client_secret'])) {
                return redirect()->away($back.'?error=1');
            }

            $res = Http::asForm()->timeout(15)->post(GoogleCalendarClient::TOKEN_URL, [
                'code' => $request->query('code'),
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'redirect_uri' => GoogleCalendarClient::redirectUri(),
                'grant_type' => 'authorization_code',
            ])->throw();
            $access = (string) $res->json('access_token');
            if ($access === '') {
                return redirect()->away($back.'?error=1');
            }

            $email = $this->emailFromIdToken((string) $res->json('id_token'));
            if (! $email) {
                $email = Http::withToken($access)->timeout(10)->get('https://openidconnect.googleapis.com/v1/userinfo')->json('email');
            }

            $existing = GoogleCalendarToken::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->first();
            $token = $existing ?? new GoogleCalendarToken(['tenant_id' => $tenant->id]);
            $token->forceFill([
                'tenant_id' => $tenant->id,
                'access_token' => $access,
                // Google omits refresh_token on re-consent sometimes; keep the old one.
                'refresh_token' => $res->json('refresh_token') ?: $existing?->refresh_token,
                'expires_at' => now()->addSeconds((int) ($res->json('expires_in') ?: 3600)),
                'email' => $email,
            ])->save();
        } catch (Throwable $e) {
            Log::warning('Google Calendar OAuth callback failed', ['error' => $e->getMessage()]);

            return redirect()->away($back.'?error=1');
        }

        return redirect()->away($back.'?connected=1');
    }

    private function emailFromIdToken(string $idToken): ?string
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            return null;
        }
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);

        return is_array($payload) ? ($payload['email'] ?? null) : null;
    }
}
