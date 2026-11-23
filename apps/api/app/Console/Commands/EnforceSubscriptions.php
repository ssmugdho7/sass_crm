<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;

class EnforceSubscriptions extends Command
{
    protected $signature = 'subscriptions:enforce';

    protected $description = 'Move lapsed tenants along the lifecycle: active → past_due at period end, past_due → suspended after 7 days grace, expired trials → suspended.';

    public function handle(): void
    {
        $pastDue = Tenant::where('status', 'active')->whereNotNull('current_period_end')->where('current_period_end', '<', now())
            ->update(['status' => 'past_due']);
        $suspended = Tenant::where('status', 'past_due')->where('current_period_end', '<', now()->subDays(7))
            ->update(['status' => 'suspended']);
        $trialsEnded = Tenant::where('status', 'trial')->whereNotNull('trial_ends_at')->where('trial_ends_at', '<', now())
            ->update(['status' => 'suspended']);
        $this->info("past_due: {$pastDue}, suspended: {$suspended}, trials_suspended: {$trialsEnded}");
    }
}
