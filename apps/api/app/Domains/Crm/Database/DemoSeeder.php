<?php

namespace App\Domains\Crm\Database;

use App\Models\Customer;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Task;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Seeder;

/** Realistic construction demo data for tenant `demo-builders`. Idempotent: keyed on natural names. */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'demo-builders')->first();
        if (! $tenant) {
            return;
        }
        $previous = CurrentTenant::get();
        CurrentTenant::set($tenant);

        try {
            $this->seed($tenant);
        } finally {
            CurrentTenant::set($previous);
        }
    }

    private function seed(Tenant $tenant): void
    {
        $ownerId = $tenant->users()->orderBy('id')->value('id');

        $customers = [];
        foreach ([
            ['name' => 'Sarah Mitchell', 'type' => 'individual', 'email' => 'sarah.mitchell@example.com', 'phone' => '(555) 201-4410', 'address' => '12 Oak St', 'city' => 'Springfield'],
            ['name' => 'Harbor View Dental', 'type' => 'company', 'email' => 'office@harborviewdental.example', 'phone' => '(555) 330-9120', 'address' => '480 Harbor Blvd', 'city' => 'Springfield', 'notes' => 'Contact: Dr. Alan Reyes'],
            ['name' => 'James & Priya Patel', 'type' => 'individual', 'email' => 'patel.family@example.com', 'phone' => '(555) 778-2231', 'address' => '7 Birch Lane', 'city' => 'Shelbyville'],
            ['name' => 'Greenfield Property Group', 'type' => 'company', 'email' => 'maintenance@greenfieldpg.example', 'phone' => '(555) 640-0099', 'address' => '1100 Commerce Way', 'city' => 'Capital City'],
        ] as $c) {
            $customers[$c['name']] = Customer::firstOrCreate(['name' => $c['name']], $c);
        }

        foreach ([
            ['name' => 'Tom Becker', 'email' => 'tom.becker@example.com', 'phone' => '(555) 410-3321', 'service' => 'Bathroom renovation', 'source' => 'website', 'status' => 'new', 'value' => 1850000, 'address' => '33 Elm Ct', 'message' => 'Looking to redo our master bath — walk-in shower, double vanity.'],
            ['name' => 'Linda Chavez', 'email' => 'lchavez@example.com', 'phone' => '(555) 902-1187', 'service' => 'Deck build', 'source' => 'referral', 'status' => 'contacted', 'value' => 2400000, 'address' => '58 Lakeview Dr', 'message' => 'Referred by the Patels. Want a 400 sq ft composite deck.'],
            ['name' => 'Marcus Lee', 'company' => 'Lee Holdings LLC', 'email' => 'marcus@leeholdings.example', 'phone' => '(555) 223-7788', 'service' => 'Office fit-out', 'source' => 'phone', 'status' => 'qualified', 'value' => 9500000, 'address' => '200 Main St, Suite 4', 'message' => 'Second-floor office, 3,000 sq ft, partitions + electrical.'],
            ['name' => 'Rachel Owens', 'email' => 'rachel.owens@example.com', 'phone' => '(555) 667-0042', 'service' => 'Roof replacement', 'source' => 'website', 'status' => 'new', 'value' => 1600000, 'address' => '9 Maple Ave', 'message' => 'Storm damage, asphalt shingles, insurance claim open.'],
            ['name' => 'Dev Sharma', 'email' => 'dev.sharma@example.com', 'phone' => '(555) 318-5510', 'service' => 'Basement finishing', 'source' => 'social', 'status' => 'contacted', 'value' => 4200000, 'address' => '71 Cedar Rd'],
            ['name' => 'Karen Doyle', 'email' => 'kdoyle@example.com', 'phone' => '(555) 812-4477', 'service' => 'Window replacement', 'source' => 'manual', 'status' => 'lost', 'value' => 900000, 'address' => '15 Pine St', 'message' => 'Went with a cheaper quote.'],
            ['name' => 'Victor Alvarez', 'email' => 'valvarez@example.com', 'phone' => '(555) 455-9031', 'service' => 'Home addition', 'source' => 'referral', 'status' => 'qualified', 'value' => 12500000, 'address' => '4 Willow Way', 'message' => 'Two-storey rear addition, needs permit drawings.'],
            ['name' => 'Sarah Mitchell', 'email' => 'sarah.mitchell@example.com', 'phone' => '(555) 201-4410', 'service' => 'Kitchen remodel', 'source' => 'website', 'status' => 'won', 'value' => 4800000, 'address' => '12 Oak St', 'customer_id' => $customers['Sarah Mitchell']->id],
        ] as $l) {
            Lead::firstOrCreate(['name' => $l['name'], 'service' => $l['service']], $l + ['assigned_to' => $ownerId]);
        }

        $projects = [];
        foreach ([
            ['name' => 'Kitchen remodel – 12 Oak St', 'customer' => 'Sarah Mitchell', 'site_address' => '12 Oak St, Springfield', 'status' => 'in_progress', 'start_date' => now()->subWeeks(3)->toDateString(), 'due_date' => now()->addWeeks(5)->toDateString(), 'budget' => 4800000, 'description' => 'Full gut and remodel: new cabinets, quartz counters, island, LED lighting.'],
            ['name' => 'Clinic renovation – 480 Harbor Blvd', 'customer' => 'Harbor View Dental', 'site_address' => '480 Harbor Blvd, Springfield', 'status' => 'planning', 'start_date' => now()->addWeeks(2)->toDateString(), 'due_date' => now()->addMonths(3)->toDateString(), 'budget' => 18500000, 'description' => 'Reception redesign and two new operatories.'],
            ['name' => 'Deck & patio – 7 Birch Lane', 'customer' => 'James & Priya Patel', 'site_address' => '7 Birch Lane, Shelbyville', 'status' => 'completed', 'start_date' => now()->subMonths(2)->toDateString(), 'due_date' => now()->subWeeks(3)->toDateString(), 'budget' => 2100000, 'description' => 'Composite deck with paver patio.'],
            ['name' => 'Lobby refresh – 1100 Commerce Way', 'customer' => 'Greenfield Property Group', 'site_address' => '1100 Commerce Way, Capital City', 'status' => 'on_hold', 'start_date' => now()->subWeeks(1)->toDateString(), 'due_date' => now()->addMonths(2)->toDateString(), 'budget' => 6500000, 'description' => 'Flooring, lighting and paint. On hold pending tenant approval.'],
        ] as $p) {
            $customer = $customers[$p['customer']];
            unset($p['customer']);
            $projects[$p['name']] = Project::firstOrCreate(['name' => $p['name']], $p + ['customer_id' => $customer->id, 'manager_id' => $ownerId]);
        }

        $tasks = [
            'Kitchen remodel – 12 Oak St' => [
                ['Demolition & haul-away', 'done', 'normal', -14],
                ['Rough-in plumbing inspection', 'done', 'high', -5],
                ['Install base cabinets', 'in_progress', 'high', 2],
                ['Template quartz countertops', 'todo', 'normal', 7],
                ['Order backsplash tile', 'todo', 'low', -1],
            ],
            'Clinic renovation – 480 Harbor Blvd' => [
                ['Submit permit drawings', 'in_progress', 'urgent', 3],
                ['Site walk with client', 'todo', 'normal', 5],
            ],
            'Deck & patio – 7 Birch Lane' => [
                ['Final walkthrough', 'done', 'normal', -21],
            ],
            'Lobby refresh – 1100 Commerce Way' => [
                ['Flooring samples to client', 'todo', 'normal', 10],
            ],
        ];
        foreach ($tasks as $projectName => $rows) {
            foreach ($rows as [$title, $status, $priority, $days]) {
                Task::firstOrCreate(['project_id' => $projects[$projectName]->id, 'title' => $title], [
                    'status' => $status, 'priority' => $priority, 'due_date' => now()->addDays($days)->toDateString(), 'assigned_to' => $ownerId,
                ]);
            }
        }
    }
}
