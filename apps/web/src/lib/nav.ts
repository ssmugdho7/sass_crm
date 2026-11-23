/** CRM sidebar. An item shows when the tenant has `module` enabled and the user has `perm`. */
export const crmNav: { href: string; label: string; module: string; perm: string }[] = [
  { href: "/app", label: "Dashboard", module: "dashboard", perm: "dashboard.view" },
  { href: "/app/leads", label: "Leads", module: "leads", perm: "leads.view" },
  { href: "/app/customers", label: "Customers", module: "customers", perm: "customers.view" },
  { href: "/app/projects", label: "Projects", module: "projects", perm: "projects.view" },
  { href: "/app/tasks", label: "Tasks", module: "tasks", perm: "tasks.view" },
  { href: "/app/estimates", label: "Estimates", module: "estimates", perm: "estimates.view" },
  { href: "/app/invoices", label: "Invoices", module: "invoices", perm: "invoices.view" },
  { href: "/app/appointments", label: "Appointments", module: "appointments", perm: "appointments.view" },
  { href: "/app/subcontractors", label: "Subcontractors", module: "subcontractors", perm: "subcontractors.view" },
  { href: "/app/timesheets", label: "Timesheets", module: "timesheets", perm: "timesheets.view" },
  { href: "/app/expenses", label: "Expenses", module: "expenses", perm: "expenses.view" },
  { href: "/app/website", label: "Website", module: "website", perm: "website.manage" },
  { href: "/app/team", label: "Team & Roles", module: "team", perm: "team.view" },
  { href: "/app/addons", label: "Add-ons", module: "dashboard", perm: "account.manage" },
  { href: "/app/billing", label: "Subscription", module: "dashboard", perm: "account.manage" },
  { href: "/app/settings", label: "Settings", module: "dashboard", perm: "dashboard.view" },
];

export const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tenants", label: "CRM Accounts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/modules", label: "Modules" },
];
