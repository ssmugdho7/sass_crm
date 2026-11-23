<?php

use App\Domains\Marketing\Http\PlanCatalogController;
use Illuminate\Support\Facades\Route;

Route::prefix('public')->group(function () {
    Route::get('plans', PlanCatalogController::class);
});
