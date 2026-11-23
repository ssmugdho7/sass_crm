<?php

namespace App\Domains\Operations\Database;

use App\Domains\Operations\Models\Appointment;
use App\Domains\Operations\Models\Expense;
use App\Domains\Operations\Models\Subcontractor;
use App\Domains\Operations\Models\Timesheet;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Idempotent demo data for the demo-builders tenant: installs the 4 operations add-ons and seeds sample rows. */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'demo-builders')->first();
        if (! $tenant) {
            return;
        }
        $tid = $tenant->id;

        $planKeys = $tenant->plan?->included_modules ?? [];
        foreach (['appointments', 'subcontractors', 'timesheets', 'expenses'] as $key) {
            TenantModule::withoutGlobalScope('tenant')->firstOrCreate(
                ['tenant_id' => $tid, 'module_key' => $key],
                ['status' => 'active', 'source' => in_array($key, $planKeys, true) ? 'plan' : 'addon'],
            );
        }

        $owner = User::where('tenant_id', $tid)->orderBy('id')->first();
        $projects = Project::withoutGlobalScope('tenant')->where('tenant_id', $tid)->orderBy('id')->get();
        if (! $projects->count()) {
            $projects = collect([
                $this->make(Project::class, $tid, ['name' => 'Kitchen remodel — Oak St'], ['status' => 'in_progress', 'budget' => 4_500_000, 'site_address' => '12 Oak St']),
            ]);
        }
        $p1 = $projects->first();
        $p2 = $projects->get(1) ?? $p1;

        $start = today()->startOfWeek()->addDays(1)->setTime(9, 0);
        $this->make(Appointment::class, $tid, ['title' => 'Site visit — '.$p1->name], [
            'starts_at' => $start, 'ends_at' => $start->copy()->addHour(), 'status' => 'confirmed', 'source' => 'manual',
            'project_id' => $p1->id, 'assigned_to' => $owner?->id, 'location' => $p1->site_address,
        ]);
        $this->make(Appointment::class, $tid, ['title' => 'Bathroom consultation — Priya Shah'], [
            'starts_at' => $start->copy()->addDays(2)->setTime(14, 0), 'ends_at' => $start->copy()->addDays(2)->setTime(15, 0),
            'status' => 'requested', 'source' => 'website', 'contact_name' => 'Priya Shah', 'contact_email' => 'priya@example.test',
            'contact_phone' => '555-0142', 'notes' => 'Wants a walk-in shower quote.',
        ]);

        $elec = $this->make(Subcontractor::class, $tid, ['company_name' => 'Bright Spark Electrical'], [
            'contact_name' => 'Tom Reyes', 'trade' => 'Electrical', 'email' => 'tom@brightspark.test', 'phone' => '555-0101',
            'license_number' => 'EL-44821', 'insurance_expiry' => today()->addDays(18), 'rate' => 8500, 'status' => 'active',
        ]);
        $plumb = $this->make(Subcontractor::class, $tid, ['company_name' => 'FlowRight Plumbing'], [
            'contact_name' => 'Dana Kim', 'trade' => 'Plumbing', 'email' => 'dana@flowright.test', 'phone' => '555-0102',
            'license_number' => 'PL-19302', 'insurance_expiry' => today()->addMonths(8), 'rate' => 7800, 'status' => 'active',
        ]);
        $elec->projects()->syncWithoutDetaching([$p1->id => ['scope' => 'Rewire kitchen circuits', 'agreed_amount' => 380_000]]);
        $plumb->projects()->syncWithoutDetaching([$p2->id => ['scope' => 'Rough-in and fixtures', 'agreed_amount' => 290_000]]);

        if ($owner) {
            foreach ([[0, 8], [1, 7.5], [2, 6]] as [$offset, $hours]) {
                $this->make(Timesheet::class, $tid, ['user_id' => $owner->id, 'work_date' => today()->startOfWeek()->addDays($offset)->toDateString()], [
                    'project_id' => $p1->id, 'hours' => $hours, 'hourly_rate' => 4500, 'notes' => 'Demolition and prep', 'approved' => $offset === 0,
                ]);
            }
        }

        foreach ([
            ['materials', 'BuildMart Supply', 'Cabinets and countertops', 1_250_000, 8],
            ['equipment', 'RentAll', 'Dumpster rental', 45_000, 6],
            ['permits', 'City Building Dept', 'Renovation permit', 32_000, 12],
        ] as [$cat, $vendor, $desc, $amount, $daysAgo]) {
            $this->make(Expense::class, $tid, ['description' => $desc, 'project_id' => $p1->id], [
                'category' => $cat, 'vendor' => $vendor, 'amount' => $amount, 'expense_date' => today()->subDays($daysAgo),
            ]);
        }
    }

    /** firstOrCreate bypassing the tenant scope with an explicit tenant_id. */
    private function make(string $class, int $tid, array $match, array $values = [])
    {
        $existing = $class::withoutGlobalScope('tenant')->where('tenant_id', $tid)->where($match)->first();
        if ($existing) {
            return $existing;
        }
        $model = new $class(array_merge($match, $values));
        $model->tenant_id = $tid;
        $model->save();

        return $model;
    }
}
