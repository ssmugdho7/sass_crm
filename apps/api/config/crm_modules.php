<?php

// Single source of truth for the module catalog. Synced into the `modules` table by ModuleCatalogSeeder.
// core=true modules are always enabled for every tenant. Others are add-ons installed from the dashboard.
return [
    'dashboard' => ['name' => 'Dashboard', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Overview of jobs, leads and revenue.', 'permissions' => ['dashboard.view']],
    'leads' => ['name' => 'Leads', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Capture and qualify construction enquiries.', 'permissions' => ['leads.view', 'leads.manage']],
    'customers' => ['name' => 'Customers', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Clients and their contacts.', 'permissions' => ['customers.view', 'customers.manage']],
    'projects' => ['name' => 'Projects / Jobs', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Construction jobs with site address, stage and budget.', 'permissions' => ['projects.view', 'projects.manage']],
    'tasks' => ['name' => 'Tasks', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Assign and track work per job.', 'permissions' => ['tasks.view', 'tasks.manage']],
    'estimates' => ['name' => 'Estimates', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Line-item quotes that convert to invoices.', 'permissions' => ['estimates.view', 'estimates.manage']],
    'invoices' => ['name' => 'Invoices', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Bill clients and record payments.', 'permissions' => ['invoices.view', 'invoices.manage']],
    'team' => ['name' => 'Team & Roles', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Invite staff and control what they can do.', 'permissions' => ['team.view', 'team.manage', 'account.manage']], // account.manage: billing, add-ons, company profile
    'website' => ['name' => 'Service Website', 'category' => 'core', 'core' => true, 'price' => 0, 'description' => 'Your public company website, built from the content you add.', 'permissions' => ['website.manage']],

    'payment_gateway' => ['name' => 'Online Payments (Stripe)', 'category' => 'payments', 'core' => false, 'price' => 1500, 'description' => 'Let clients pay invoices online by card through Stripe Checkout.', 'permissions' => ['payments.manage'], 'config' => ['publishable_key' => 'text', 'secret_key' => 'secret', 'webhook_secret' => 'secret', 'currency' => 'text']],
    'google_calendar' => ['name' => 'Google Calendar', 'category' => 'productivity', 'core' => false, 'price' => 500, 'description' => 'Sync appointments and site visits to Google Calendar.', 'permissions' => ['calendar.manage'], 'config' => ['client_id' => 'text', 'client_secret' => 'secret', 'calendar_id' => 'text']],
    'appointments' => ['name' => 'Appointments', 'category' => 'productivity', 'core' => false, 'price' => 500, 'description' => 'Book site visits and consultations; public booking form on your website.', 'permissions' => ['appointments.view', 'appointments.manage']],
    'subcontractors' => ['name' => 'Subcontractors', 'category' => 'operations', 'core' => false, 'price' => 1000, 'description' => 'Manage subcontractors, trades, insurance expiry and job assignments.', 'permissions' => ['subcontractors.view', 'subcontractors.manage']],
    'timesheets' => ['name' => 'Timesheets', 'category' => 'operations', 'core' => false, 'price' => 1000, 'description' => 'Log crew hours against jobs.', 'permissions' => ['timesheets.view', 'timesheets.manage']],
    'expenses' => ['name' => 'Job Expenses', 'category' => 'finance', 'core' => false, 'price' => 800, 'description' => 'Track material and labour costs per job for profit tracking.', 'permissions' => ['expenses.view', 'expenses.manage']],
];
