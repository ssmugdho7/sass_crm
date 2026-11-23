<?php

namespace App\Domains\Website\Actions;

use App\Domains\Website\Models\SiteSetting;
use App\Models\Tenant;

/** Returns the tenant's site settings, creating sensible defaults from the tenant profile on first use. */
class EnsureSiteSettings
{
    public function __invoke(Tenant $tenant): SiteSetting
    {
        return SiteSetting::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->first()
            ?? tap(new SiteSetting([
                'published' => true,
                'theme_color' => '#ea580c',
                'hero_title' => "{$tenant->name} — quality construction you can trust",
                'hero_subtitle' => 'Residential and commercial building, renovations and repairs. Licensed, insured and on schedule.',
                'about_title' => "About {$tenant->name}",
                'email' => $tenant->email,
                'phone' => $tenant->phone,
                'service_areas' => [],
                'social' => ['facebook' => null, 'instagram' => null, 'linkedin' => null, 'youtube' => null],
                'seo_title' => $tenant->name,
            ]), function (SiteSetting $s) use ($tenant) {
                $s->tenant_id = $tenant->id;
                $s->save();
            })->refresh();
    }
}
