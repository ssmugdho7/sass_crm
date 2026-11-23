<?php

namespace App\Domains\Website\Http;

use App\Domains\Website\Actions\EnsureSiteSettings;
use App\Domains\Website\Models\SiteFaq;
use App\Domains\Website\Models\SitePortfolio;
use App\Domains\Website\Models\SiteService;
use App\Domains\Website\Models\SiteSetting;
use App\Domains\Website\Models\SiteTeamMember;
use App\Domains\Website\Models\SiteTestimonial;
use App\Models\Lead;
use App\Models\Tenant;
use Illuminate\Http\Request;

/** Public, unauthenticated tenant website. Every query filters by tenant explicitly. */
class PublicSiteController
{
    private function tenant(string $slug): Tenant
    {
        $tenant = Tenant::where('slug', $slug)->first();
        abort_if(! $tenant || ! $tenant->isAccessible(), 404, 'Site not found.');

        return $tenant;
    }

    private function scoped(string $class, Tenant $tenant)
    {
        return $class::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id);
    }

    public function show(string $slug, EnsureSiteSettings $ensure)
    {
        $tenant = $this->tenant($slug);
        $settings = $ensure($tenant);
        abort_unless($settings->published, 404, 'Site not found.');

        $hidden = ['tenant_id', 'created_at', 'updated_at'];
        $get = fn (string $class, bool $publishable = true) => $this->scoped($class, $tenant)
            ->when($publishable, fn ($q) => $q->where('is_published', true))
            ->orderBy('sort')->orderBy('id')->get()->makeHidden($hidden);

        return [
            'tenant' => ['name' => $tenant->name, 'slug' => $tenant->slug],
            'settings' => $settings->makeHidden([...$hidden, 'id']),
            'services' => $get(SiteService::class),
            'portfolio' => $get(SitePortfolio::class)->makeHidden('project_id'),
            'testimonials' => $get(SiteTestimonial::class),
            'team' => $get(SiteTeamMember::class, false),
            'faqs' => $get(SiteFaq::class, false),
            'features' => ['booking' => $tenant->hasModule('appointments')],
        ];
    }

    public function lead(Request $request, string $slug)
    {
        $tenant = $this->tenant($slug);
        abort_unless(SiteSetting::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->value('published') ?? true, 404, 'Site not found.');

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required_without:phone|nullable|email|max:255',
            'phone' => 'required_without:email|nullable|string|max:50',
            'service' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'message' => 'nullable|string|max:5000',
            'website' => 'prohibited', // honeypot: real visitors never fill it
        ]);

        $lead = new Lead([...$data, 'source' => 'website', 'status' => 'new']);
        $lead->tenant_id = $tenant->id;
        $lead->save();

        return response()->json(['ok' => true, 'message' => 'Thanks! We will be in touch shortly.'], 201);
    }
}
