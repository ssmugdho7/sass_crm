<?php

use Illuminate\Support\Facades\Route;

// Each domain owns its routes in app/Domains/{Name}/routes.php (loaded under the /api prefix).
// Conventions:
//   tenant CRM:   Route::middleware(['auth:sanctum', 'tenant'])->prefix('app')  + 'module:key' + 'perm:x.y'
//   super admin:  Route::middleware(['auth:sanctum', 'super'])->prefix('platform')
//   public:       Route::prefix('public')
foreach (glob(app_path('Domains/*/routes.php')) as $file) {
    require $file;
}
