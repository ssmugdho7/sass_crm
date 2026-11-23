<?php

namespace App\Domains\Integrations\Services;

/** Manual verification of the Stripe-Signature header (no SDK). */
class StripeSignature
{
    public static function verify(string $payload, ?string $header, string $secret, int $tolerance = 300): bool
    {
        if (! $header || $secret === '') {
            return false;
        }
        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $header) as $part) {
            [$k, $v] = array_pad(explode('=', trim($part), 2), 2, '');
            if ($k === 't') {
                $timestamp = $v;
            } elseif ($k === 'v1') {
                $signatures[] = $v;
            }
        }
        if (! $timestamp || ! ctype_digit($timestamp) || ! $signatures || abs(time() - (int) $timestamp) > $tolerance) {
            return false;
        }
        $expected = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);
        foreach ($signatures as $sig) {
            if (hash_equals($expected, $sig)) {
                return true;
            }
        }

        return false;
    }

    public static function header(string $payload, string $secret, ?int $time = null): string
    {
        $t = $time ?? time();

        return 't='.$t.',v1='.hash_hmac('sha256', $t.'.'.$payload, $secret);
    }
}
