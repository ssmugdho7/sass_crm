<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        foreach (glob(app_path('Domains/*/*ServiceProvider.php')) as $file) {
            $domain = basename(dirname($file));
            $this->app->register('App\\Domains\\'.$domain.'\\'.basename($file, '.php'));
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->loadMigrationsFrom(glob(app_path('Domains/*/Database/Migrations')));
    }
}
