<?php

use App\Domains\Identity\Http\AuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('platform/login', [AuthController::class, 'platformLogin'])->middleware('throttle:10,1');
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'show']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});
