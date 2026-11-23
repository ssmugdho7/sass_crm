<?php

namespace App\Domains\Website\Actions;

use App\Domains\Website\Models\SiteFaq;
use App\Domains\Website\Models\SitePortfolio;
use App\Domains\Website\Models\SiteService;
use App\Domains\Website\Models\SiteSetting;
use App\Domains\Website\Models\SiteTeamMember;
use App\Domains\Website\Models\SiteTestimonial;

/** Website completion checklist for the current tenant, so the site "keeps growing". */
class BuildChecklist
{
    /** @return array{percent:int,done:int,total:int,items:list<array{key:string,label:string,done:bool,hint:string}>} */
    public function __invoke(SiteSetting $s): array
    {
        $services = SiteService::where('is_published', true)->count();
        $items = [
            ['logo', 'Upload your logo', (bool) $s->logo_url, 'Branding & SEO'],
            ['hero', 'Hero headline and photo', $s->hero_title && $s->hero_image_url, 'Hero & About'],
            ['about', 'Tell your story', mb_strlen((string) $s->about_body) >= 40, 'Hero & About'],
            ['services', 'Add at least 3 services', $services >= 3, "{$services}/3 services"],
            ['portfolio', 'Showcase a completed project', SitePortfolio::where('is_published', true)->exists(), 'Portfolio'],
            ['testimonial', 'Add a client testimonial', SiteTestimonial::where('is_published', true)->exists(), 'Testimonials'],
            ['team', 'Introduce your team', SiteTeamMember::exists(), 'Team'],
            ['faq', 'Answer common questions', SiteFaq::exists(), 'FAQ'],
            ['contact', 'Phone, email and address', $s->phone && $s->email && $s->address, 'Contact & areas'],
            ['areas', 'List your service areas', count($s->service_areas ?? []) > 0, 'Contact & areas'],
            ['seo', 'Search title and description', $s->seo_title && $s->seo_description, 'Branding & SEO'],
        ];
        $items = array_map(fn ($i) => ['key' => $i[0], 'label' => $i[1], 'done' => (bool) $i[2], 'hint' => $i[3]], $items);
        $done = count(array_filter($items, fn ($i) => $i['done']));

        return ['percent' => (int) round($done / count($items) * 100), 'done' => $done, 'total' => count($items), 'items' => $items];
    }
}
