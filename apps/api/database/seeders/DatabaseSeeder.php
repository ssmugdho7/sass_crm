<?php

namespace Database\Seeders;

use App\Domains\Crm\Database\DemoSeeder;
use App\Domains\Identity\Actions\RegisterTenant;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->command?->callSilent('modules:sync') ?? Artisan::call('modules:sync');

        $plans = [
            ['name' => 'Starter', 'slug' => 'starter', 'price_monthly' => 2900, 'price_yearly' => 29000, 'max_users' => 3, 'sort' => 1, 'included_modules' => [],
                'features' => ['Leads, customers & jobs', 'Estimates & invoices', 'Service website', 'Up to 3 users']],
            ['name' => 'Growth', 'slug' => 'growth', 'price_monthly' => 7900, 'price_yearly' => 79000, 'max_users' => 10, 'sort' => 2, 'included_modules' => ['appointments', 'payment_gateway'],
                'features' => ['Everything in Starter', 'Online payments', 'Appointments & booking form', 'Up to 10 users']],
            ['name' => 'Pro', 'slug' => 'pro', 'price_monthly' => 14900, 'price_yearly' => 149000, 'max_users' => 50, 'sort' => 3, 'included_modules' => ['appointments', 'payment_gateway', 'google_calendar', 'subcontractors', 'timesheets', 'expenses'],
                'features' => ['Everything in Growth', 'Subcontractors & timesheets', 'Job costing', 'Google Calendar sync', 'Up to 50 users']],
        ];
        foreach ($plans as $p) {
            Plan::updateOrCreate(['slug' => $p['slug']], $p);
        }

        User::firstOrCreate(['email' => 'admin@sasscrm.test'], [
            'name' => 'Super Admin', 'password' => 'password',
        ])->forceFill(['is_super_admin' => true])->save();

        if (! User::where('email', 'owner@demo.test')->exists()) {
            app(RegisterTenant::class)([
                'company' => 'Demo Builders', 'name' => 'Demo Owner', 'email' => 'owner@demo.test', 'password' => 'password', 'plan' => 'growth',
            ]);
        }

        if (! app()->runningUnitTests()) {
            $this->call([
                DemoSeeder::class,
                \App\Domains\Sales\Database\DemoSeeder::class,
                \App\Domains\Operations\Database\DemoSeeder::class,
                \App\Domains\Website\Database\DemoSeeder::class,
            ]);
        }
    }
}
