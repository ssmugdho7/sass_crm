<?php

namespace App\Domains\Crm\Actions;

use App\Models\Customer;
use App\Models\Lead;
use App\Models\Project;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ConvertLead
{
    /** @return array{customer: Customer, project: ?Project, lead: Lead} */
    public function __invoke(Lead $lead, bool $createProject = false): array
    {
        if ($lead->customer_id) {
            throw ValidationException::withMessages(['lead' => 'This lead has already been converted.']);
        }

        return DB::transaction(function () use ($lead, $createProject) {
            $customer = Customer::create([
                'type' => $lead->company ? 'company' : 'individual',
                'name' => $lead->company ?: $lead->name,
                'email' => $lead->email, 'phone' => $lead->phone, 'address' => $lead->address,
                'notes' => $lead->company ? "Contact: {$lead->name}" : null,
            ]);
            $project = null;
            if ($createProject) {
                $project = Project::create([
                    'customer_id' => $customer->id,
                    'name' => trim(($lead->service ?: 'New project').($lead->address ? ' – '.$lead->address : '')),
                    'site_address' => $lead->address, 'budget' => $lead->value,
                    'description' => $lead->message, 'manager_id' => $lead->assigned_to,
                ]);
            }
            $lead->update(['status' => 'won', 'customer_id' => $customer->id]);

            return ['customer' => $customer, 'project' => $project, 'lead' => $lead->fresh()];
        });
    }
}
