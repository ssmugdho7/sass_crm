<?php

namespace App\Domains\Identity\Actions;

use App\Models\Role;
use App\Models\Tenant;

class CreateTenantRoles
{
    /** Seeds default roles for a new tenant and returns the owner role. */
    public function __invoke(Tenant $tenant): Role
    {
        $owner = Role::create(['tenant_id' => $tenant->id, 'name' => 'Owner', 'slug' => 'owner', 'permissions' => ['*'], 'is_system' => true]);
        Role::create(['tenant_id' => $tenant->id, 'name' => 'Project Manager', 'slug' => 'project-manager', 'permissions' => [
            'dashboard.view', 'leads.view', 'leads.manage', 'customers.view', 'customers.manage', 'projects.view', 'projects.manage',
            'tasks.view', 'tasks.manage', 'estimates.view', 'estimates.manage', 'invoices.view', 'appointments.view', 'appointments.manage',
            'subcontractors.view', 'timesheets.view', 'timesheets.manage', 'expenses.view', 'expenses.manage',
        ]]);
        Role::create(['tenant_id' => $tenant->id, 'name' => 'Field Crew', 'slug' => 'field-crew', 'permissions' => [
            'dashboard.view', 'projects.view', 'tasks.view', 'tasks.manage', 'timesheets.view', 'timesheets.manage',
        ]]);

        return $owner;
    }
}
