<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Manual references (check numbers, ...) are free text and may repeat across invoices; only provider ids
     * (Stripe checkout session ids) are globally unique, so dedupe on a dedicated nullable external_ref.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique('payments_tenant_method_reference_unique');
            $table->string('external_ref')->nullable();
        });
        DB::table('payments')->where('method', 'stripe')->whereNotNull('reference')->update(['external_ref' => DB::raw('reference')]);
        Schema::table('payments', function (Blueprint $table) {
            $table->unique(['tenant_id', 'external_ref'], 'payments_tenant_external_ref_unique');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique('payments_tenant_external_ref_unique');
            $table->dropColumn('external_ref');
            $table->unique(['tenant_id', 'method', 'reference'], 'payments_tenant_method_reference_unique');
        });
    }
};
