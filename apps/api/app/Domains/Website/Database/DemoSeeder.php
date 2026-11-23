<?php

namespace App\Domains\Website\Database;

use App\Domains\Website\Models\SiteFaq;
use App\Domains\Website\Models\SitePortfolio;
use App\Domains\Website\Models\SiteService;
use App\Domains\Website\Models\SiteSetting;
use App\Domains\Website\Models\SiteTeamMember;
use App\Domains\Website\Models\SiteTestimonial;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/** Rich, idempotent website content for the demo tenant (slug demo-builders). */
class DemoSeeder extends Seeder
{
    private const IMG = 'https://images.unsplash.com/';

    private static function img(string $id, int $w = 1600): string
    {
        return self::IMG.$id."?auto=format&fit=crop&w={$w}&q=80";
    }

    public function run(): void
    {
        $tenant = Tenant::where('slug', 'demo-builders')->first();
        if (! $tenant) {
            return;
        }

        $settings = SiteSetting::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id]);
        $settings->tenant_id = $tenant->id;
        $settings->fill([
            'published' => true,
            'theme_color' => '#ea580c',
            'logo_url' => null,
            'hero_title' => 'We build homes and spaces that last for generations',
            'hero_subtitle' => 'Custom homes, renovations, kitchens and commercial fit-outs across the Bay Area. Fixed-price quotes, licensed crews, and a 10-year workmanship warranty.',
            'hero_image_url' => self::img('photo-1503387762-592deb58ef4e', 2000),
            'about_title' => 'Family-owned builders since 2008',
            'about_body' => "Demo Builders started with one truck and a promise: show up on time, keep the site clean and build it right the first time.\n\nToday our team of 25 carpenters, project managers and trades delivers custom homes, renovations and light commercial work. Every job gets a dedicated project manager, a written schedule and weekly photo updates — so you always know where your project stands.",
            'phone' => '(415) 555-0142',
            'email' => 'hello@demobuilders.test',
            'address' => '1200 Harbor Way, Suite 4, San Francisco, CA 94107',
            'service_areas' => ['San Francisco', 'Oakland', 'Berkeley', 'San Mateo', 'Palo Alto', 'Walnut Creek'],
            'hours' => 'Mon–Fri 7:00–17:00 · Sat 8:00–12:00',
            'social' => ['facebook' => 'https://facebook.com/demobuilders', 'instagram' => 'https://instagram.com/demobuilders', 'linkedin' => 'https://linkedin.com/company/demobuilders', 'youtube' => null],
            'seo_title' => 'Demo Builders — Custom Homes & Renovations in the Bay Area',
            'seo_description' => 'Licensed general contractor for custom homes, kitchen and bath remodels, additions and commercial fit-outs. Free on-site quotes.',
            'license_info' => 'CA License #1048576 · Fully insured & bonded',
            'years_in_business' => 18,
        ])->save();

        $this->seed(SiteService::class, $tenant, 'title', [
            ['title' => 'Custom Home Building', 'icon' => 'home', 'price_from' => 45000000, 'image_url' => self::img('photo-1600585154340-be6161a56a0c', 1200),
                'summary' => 'From lot to keys: design-build custom homes with one accountable team.',
                'body' => 'We handle permits, engineering, framing, finishes and final inspection. Transparent cost-plus or fixed-price contracts.'],
            ['title' => 'Kitchen Remodeling', 'icon' => 'kitchen', 'price_from' => 3500000, 'image_url' => self::img('photo-1556909114-f6e7ad7d3136', 1200),
                'summary' => 'Open layouts, custom cabinetry and stone counters — done in weeks, not months.',
                'body' => 'Includes design consultation, demolition, plumbing and electrical rough-in, cabinetry, counters and tile.'],
            ['title' => 'Bathroom Renovation', 'icon' => 'bath', 'price_from' => 1800000, 'image_url' => self::img('photo-1552321554-5fefe8c9ef14', 1200),
                'summary' => 'Walk-in showers, heated floors and waterproofing built to last.',
                'body' => 'Full gut renovations and accessible bathroom conversions with certified waterproofing systems.'],
            ['title' => 'Home Additions & ADUs', 'icon' => 'addition', 'price_from' => 15000000, 'image_url' => self::img('photo-1513694203232-719a280e022f', 1200),
                'summary' => 'Add space and value with second stories, extensions and accessory dwelling units.',
                'body' => 'We manage zoning, structural engineering and utility connections for seamless additions.'],
            ['title' => 'Roofing & Exteriors', 'icon' => 'roof', 'price_from' => 1200000, 'image_url' => self::img('photo-1632759145351-1d592919f522', 1200),
                'summary' => 'Roof replacement, siding, windows and decks that stand up to the weather.',
                'body' => 'Asphalt, metal and tile roofing; fiber-cement siding; energy-efficient window replacement.'],
            ['title' => 'Commercial Fit-outs', 'icon' => 'commercial', 'price_from' => null, 'image_url' => self::img('photo-1497366216548-37526070297c', 1200),
                'summary' => 'Offices, retail and restaurants delivered on schedule with minimal disruption.',
                'body' => 'Tenant improvements, ADA upgrades and after-hours work to keep your business running.'],
        ]);

        $this->seed(SitePortfolio::class, $tenant, 'title', [
            ['title' => 'Modern Hillside Residence', 'location' => 'Berkeley, CA', 'category' => 'Custom Home', 'completed_on' => '2026-06-15',
                'description' => 'A 3,200 sq ft four-bedroom home on a steep lot with a cantilevered deck, floor-to-ceiling glazing and solar-ready roof.',
                'cover_url' => self::img('photo-1600596542815-ffad4c1539a9'),
                'images' => [self::img('photo-1600607687939-ce8a6c25118c'), self::img('photo-1600566753190-17f0baa2a6c3'), self::img('photo-1600210492486-724fe5c67fb0')]],
            ['title' => 'Victorian Kitchen Restoration', 'location' => 'San Francisco, CA', 'category' => 'Kitchen', 'completed_on' => '2026-03-02',
                'description' => 'Opened a closed 1890s kitchen into the dining room while preserving original millwork. Quartz counters and custom walnut cabinetry.',
                'cover_url' => self::img('photo-1556912173-3bb406ef7e77'),
                'images' => [self::img('photo-1556911220-bff31c812dba'), self::img('photo-1565538810643-b5bdb714032a')]],
            ['title' => 'Spa Bathroom Remodel', 'location' => 'Palo Alto, CA', 'category' => 'Bathroom', 'completed_on' => '2025-11-20',
                'description' => 'Curbless walk-in shower, freestanding tub, heated floors and a double vanity in a primary suite.',
                'cover_url' => self::img('photo-1620626011761-996317b8d101'),
                'images' => [self::img('photo-1584622650111-993a426fbf0a'), self::img('photo-1600566752355-35792bedcfea')]],
            ['title' => 'Backyard ADU', 'location' => 'Oakland, CA', 'category' => 'Addition', 'completed_on' => '2025-09-08',
                'description' => 'A 640 sq ft one-bedroom accessory dwelling unit with full kitchen, permitted and rented within a month of completion.',
                'cover_url' => self::img('photo-1570129477492-45c003edd2be'),
                'images' => [self::img('photo-1505691938895-1758d7feb511'), self::img('photo-1502672260266-1c1ef2d93688')]],
            ['title' => 'Tech Office Fit-out', 'location' => 'San Mateo, CA', 'category' => 'Commercial', 'completed_on' => '2025-05-30',
                'description' => '12,000 sq ft open office with meeting pods, acoustic ceilings and a cafe — delivered in 9 weeks with after-hours work.',
                'cover_url' => self::img('photo-1497366811353-6870744d04b2'),
                'images' => [self::img('photo-1497215842964-222b430dc094'), self::img('photo-1524758631624-e2822e304c36')]],
        ]);

        $this->seed(SiteTestimonial::class, $tenant, 'author', [
            ['author' => 'Sarah & Tom Whitfield', 'role' => 'Homeowners, Berkeley', 'rating' => 5,
                'quote' => 'They built our dream home on a lot three other builders turned down. Weekly photo updates, no surprise invoices, and they finished two weeks early.'],
            ['author' => 'Marcus Lee', 'role' => 'Homeowner, San Francisco', 'rating' => 5,
                'quote' => 'Our kitchen restoration was handled with real respect for the old house. The crew cleaned up every single day.'],
            ['author' => 'Priya Nair', 'role' => 'Operations Director, Brightline', 'rating' => 5,
                'quote' => 'The office fit-out ran on schedule while our team kept working. Clear communication from start to finish.'],
            ['author' => 'Diego Ramirez', 'role' => 'Landlord, Oakland', 'rating' => 4,
                'quote' => 'The ADU paid for itself faster than expected. Permits were handled completely for us.'],
        ]);

        $this->seed(SiteTeamMember::class, $tenant, 'name', [
            ['name' => 'Daniel Brooks', 'role' => 'Founder & General Contractor', 'photo_url' => self::img('photo-1560250097-0b93528c311a', 600),
                'bio' => '25 years in residential construction. Daniel still walks every job site each week.'],
            ['name' => 'Elena Torres', 'role' => 'Senior Project Manager', 'photo_url' => self::img('photo-1573496359142-b8d87734a5a2', 600),
                'bio' => 'Keeps schedules, budgets and clients aligned. PMP certified.'],
            ['name' => 'James Okafor', 'role' => 'Site Superintendent', 'photo_url' => self::img('photo-1504257432389-52343af06ae3', 600),
                'bio' => 'Leads our framing and finish crews with a focus on safety and quality.'],
            ['name' => 'Mei Chen', 'role' => 'Design & Estimating', 'photo_url' => self::img('photo-1580489944761-15a19d654956', 600),
                'bio' => 'Turns ideas into drawings and accurate, line-item estimates.'],
        ]);

        $this->seed(SiteFaq::class, $tenant, 'question', [
            ['question' => 'Do you offer free estimates?', 'answer' => 'Yes. We visit your site, discuss your goals and send a detailed written estimate within 5 business days — free of charge.'],
            ['question' => 'Are you licensed and insured?', 'answer' => 'We are a California licensed general contractor (#1048576) with general liability and workers\' compensation insurance. Certificates available on request.'],
            ['question' => 'Do you handle permits?', 'answer' => 'Absolutely. We prepare drawings, submit applications and coordinate all inspections with the city.'],
            ['question' => 'How do payments work?', 'answer' => 'A small deposit to schedule, then progress payments tied to completed milestones. You can pay invoices online by card or bank transfer.'],
            ['question' => 'What warranty do you provide?', 'answer' => 'All workmanship carries a 10-year warranty, plus manufacturer warranties on materials and appliances.'],
        ]);
    }

    /** Create rows that don't exist yet (matched by $key) for the tenant; existing rows are left untouched. */
    private function seed(string $class, Tenant $tenant, string $key, array $rows): void
    {
        foreach ($rows as $sort => $row) {
            $model = $class::withoutGlobalScope('tenant')->firstOrNew(['tenant_id' => $tenant->id, $key => $row[$key]]);
            if (! $model->exists) {
                $model->tenant_id = $tenant->id;
                $model->fill([...$row, 'sort' => $sort])->save();
            }
        }
    }
}
