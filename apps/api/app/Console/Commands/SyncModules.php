<?php

namespace App\Console\Commands;

use App\Models\Module;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SyncModules extends Command
{
    protected $signature = 'modules:sync';

    protected $description = 'Sync config/crm_modules.php into the modules table (run on every deploy).';

    public function handle(): void
    {
        foreach (config('crm_modules') as $key => $m) {
            $module = Module::firstOrNew(['key' => $key]);
            $module->fill(['name' => $m['name'], 'category' => $m['category'], 'description' => $m['description'], 'is_core' => $m['core']]);
            if (! $module->exists) {
                $module->price_monthly = $m['price'];
            }
            $module->save();
        }
        Cache::forget('modules.catalog');
        $this->info(count(config('crm_modules')).' modules synced.');
    }
}
