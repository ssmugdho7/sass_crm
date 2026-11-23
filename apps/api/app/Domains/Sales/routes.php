<?php

use App\Domains\Sales\Http\EstimateController;
use App\Domains\Sales\Http\InvoiceController;
use App\Domains\Sales\Http\PaymentController;
use App\Domains\Sales\Http\PublicDocumentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant'])->prefix('app')->group(function () {
    Route::middleware('module:estimates')->group(function () {
        Route::middleware('perm:estimates.view')->group(function () {
            Route::get('estimates', [EstimateController::class, 'index']);
            Route::get('estimates/{estimateId}', [EstimateController::class, 'show']);
        });
        Route::middleware('perm:estimates.manage')->group(function () {
            Route::post('estimates', [EstimateController::class, 'store']);
            Route::put('estimates/{estimateId}', [EstimateController::class, 'update']);
            Route::patch('estimates/{estimateId}', [EstimateController::class, 'update']);
            Route::delete('estimates/{estimateId}', [EstimateController::class, 'destroy']);
            Route::post('estimates/{estimateId}/status', [EstimateController::class, 'status']);
            Route::post('estimates/{estimateId}/convert', [EstimateController::class, 'convert'])->middleware(['module:invoices', 'perm:invoices.manage']);
        });
    });

    Route::middleware('module:invoices')->group(function () {
        Route::middleware('perm:invoices.view')->group(function () {
            Route::get('invoices', [InvoiceController::class, 'index']);
            Route::get('invoices/{invoiceId}', [InvoiceController::class, 'show']);
            Route::get('invoices/{invoiceId}/payments', [PaymentController::class, 'index']);
        });
        Route::middleware('perm:invoices.manage')->group(function () {
            Route::post('invoices', [InvoiceController::class, 'store']);
            Route::put('invoices/{invoiceId}', [InvoiceController::class, 'update']);
            Route::patch('invoices/{invoiceId}', [InvoiceController::class, 'update']);
            Route::delete('invoices/{invoiceId}', [InvoiceController::class, 'destroy']);
            Route::post('invoices/{invoiceId}/status', [InvoiceController::class, 'status']);
            Route::post('invoices/{invoiceId}/payments', [PaymentController::class, 'store']);
            Route::delete('invoices/{invoiceId}/payments/{paymentId}', [PaymentController::class, 'destroy']);
        });
    });
});

Route::prefix('public')->group(function () {
    Route::get('invoices/{token}', [PublicDocumentController::class, 'invoice'])->middleware('throttle:60,1');
    Route::get('estimates/{token}', [PublicDocumentController::class, 'estimate'])->middleware('throttle:60,1');
    Route::post('estimates/{token}/accept', [PublicDocumentController::class, 'accept'])->middleware('throttle:10,1');
    Route::post('estimates/{token}/decline', [PublicDocumentController::class, 'decline'])->middleware('throttle:10,1');
});
