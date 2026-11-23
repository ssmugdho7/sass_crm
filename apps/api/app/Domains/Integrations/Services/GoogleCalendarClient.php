<?php

namespace App\Domains\Integrations\Services;

use App\Domains\Integrations\Models\GoogleCalendarToken;
use App\Models\Tenant;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Minimal Google Calendar API client for one tenant; refreshes the access token when expired. */
class GoogleCalendarClient
{
    public const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    public const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    public const API = 'https://www.googleapis.com/calendar/v3';

    public function __construct(private Tenant $tenant, private array $config, private GoogleCalendarToken $token) {}

    /** Returns a client when the tenant has the add-on and a stored connection, otherwise null. */
    public static function forTenant(Tenant $tenant): ?self
    {
        $config = TenantModuleConfig::for($tenant, 'google_calendar');
        if ($config === null) {
            return null;
        }
        $token = GoogleCalendarToken::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->first();

        return $token ? new self($tenant, $config, $token) : null;
    }

    public static function redirectUri(): string
    {
        return url('/api/public/google/callback');
    }

    public function calendarId(): string
    {
        return (string) ($this->config['calendar_id'] ?? '') ?: 'primary';
    }

    public function createEvent(array $event): string
    {
        $res = $this->send('post', $this->eventsUrl(), $event)->throw();

        return (string) $res->json('id');
    }

    public function updateEvent(string $eventId, array $event): Response
    {
        return $this->send('put', $this->eventsUrl().'/'.rawurlencode($eventId), $event);
    }

    public function deleteEvent(string $eventId): void
    {
        $res = $this->send('delete', $this->eventsUrl().'/'.rawurlencode($eventId));
        // 404/410 = already gone on Google's side.
        if (! $res->successful() && ! in_array($res->status(), [404, 410], true)) {
            $res->throw();
        }
    }

    private function eventsUrl(): string
    {
        return self::API.'/calendars/'.rawurlencode($this->calendarId()).'/events';
    }

    private function send(string $method, string $url, array $data = []): Response
    {
        $http = Http::withToken($this->accessToken())->acceptJson()->timeout(15);

        return $method === 'delete' ? $http->delete($url) : $http->{$method}($url, $data);
    }

    private function accessToken(): string
    {
        $expired = $this->token->expires_at && $this->token->expires_at->lte(now()->addMinute());
        if (! $expired) {
            return $this->token->access_token;
        }
        if (! $this->token->refresh_token) {
            throw new RuntimeException('Google token expired and no refresh token is stored.');
        }
        $res = Http::asForm()->timeout(15)->post(self::TOKEN_URL, [
            'client_id' => $this->config['client_id'] ?? '',
            'client_secret' => $this->config['client_secret'] ?? '',
            'refresh_token' => $this->token->refresh_token,
            'grant_type' => 'refresh_token',
        ])->throw();
        $this->token->forceFill([
            'access_token' => $res->json('access_token'),
            'expires_at' => now()->addSeconds((int) ($res->json('expires_in') ?: 3600)),
        ])->save();

        return $this->token->access_token;
    }
}
