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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class GoogleCalendarController extends Controller
{
    private const STATE_PREFIX = 'gcal_oauth:';

    private const STATE_TTL_MINUTES = 10;

    public function connect(Request $request): JsonResponse
    {
        $config = TenantModuleConfig::for(CurrentTenant::get(), 'google_calendar') ?? [];
        if (empty($config['client_id']) || empty($config['client_secret'])) {
            return response()->json(['message' => 'Add your Google client ID and client secret in the add-on settings first.'], 422);
        }
        // Opaque, single-use, short-lived nonce; the binding to tenant/user lives server-side only.
        $state = Str::random(48);
        Cache::put(self::STATE_PREFIX.$state, [
            'tenant_id' => CurrentTenant::id(), 'user_id' => $request->user()->id,
        ], now()->addMinutes(self::STATE_TTL_MINUTES));

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
        $connection = GoogleCalendarToken::first();
        $token = $connection?->refresh_token ?: $connection?->access_token;
        if ($token) {
            $response = Http::asForm()->timeout(10)->post('https://oauth2.googleapis.com/revoke', ['token' => $token]);
            // An already-invalid token needs no further revocation; other failures remain retryable.
            if (! ($response->status() === 400 && $response->json('error') === 'invalid_token')) {
                $response->throw();
            }
        }
        $connection?->delete();

        return response()->json(['ok' => true]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $back = TenantModuleConfig::frontend('/app/addons/google_calendar');
        try {
            // The state nonce is pulled (single use) and expires after STATE_TTL_MINUTES.
            // Residual risk: the API is bearer-token based with no browser session, so the callback
            // cannot prove the browser finishing the flow is the one that started it. An attacker who
            // obtains a fresh, unused nonce for *their own* tenant could only connect a Google account
            // to that tenant; they cannot target another tenant (the tenant comes from the server-side
            // nonce, and the code is exchanged with that tenant's own client credentials).
            $nonce = (string) $request->query('state');
            $state = $nonce !== '' ? Cache::pull(self::STATE_PREFIX.$nonce) : null;
            $tenant = is_array($state) ? Tenant::find($state['tenant_id'] ?? 0) : null;
            $config = $tenant ? TenantModuleConfig::for($tenant, 'google_calendar') : null;
            if (! $tenant || ! $config || ! $request->filled('code')
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
