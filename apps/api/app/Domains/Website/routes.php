<?php

use App\Domains\Website\Http\PublicSiteController;
use App\Domains\Website\Http\SiteCollectionController;
use App\Domains\Website\Http\SiteSettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant', 'module:website', 'perm:website.manage'])->prefix('app/website')->group(function () {
    Route::get('settings', [SiteSettingsController::class, 'show']);
    Route::put('settings', [SiteSettingsController::class, 'update']);
    Route::get('checklist', [SiteSettingsController::class, 'checklist']);
    Route::post('upload', [SiteSettingsController::class, 'upload'])->middleware('throttle:60,1');
    Route::get('portfolio/importable-projects', [SiteSettingsController::class, 'importableProjects']);
    Route::post('portfolio/from-project/{project}', [SiteSettingsController::class, 'importProject'])->whereNumber('project');

    $c = implode('|', array_keys(SiteCollectionController::MODELS));
    Route::get('{collection}', [SiteCollectionController::class, 'index'])->where('collection', $c);
    Route::post('{collection}', [SiteCollectionController::class, 'store'])->where('collection', $c);
    Route::post('{collection}/reorder', [SiteCollectionController::class, 'reorder'])->where('collection', $c);
    Route::get('{collection}/{id}', [SiteCollectionController::class, 'show'])->where(['collection' => $c, 'id' => '[0-9]+']);
    Route::put('{collection}/{id}', [SiteCollectionController::class, 'update'])->where(['collection' => $c, 'id' => '[0-9]+']);
    Route::delete('{collection}/{id}', [SiteCollectionController::class, 'destroy'])->where(['collection' => $c, 'id' => '[0-9]+']);
});

Route::prefix('public/sites/{slug}')->group(function () {
    Route::get('/', [PublicSiteController::class, 'show']);
    Route::post('leads', [PublicSiteController::class, 'lead'])->middleware('throttle:5,1');
});
