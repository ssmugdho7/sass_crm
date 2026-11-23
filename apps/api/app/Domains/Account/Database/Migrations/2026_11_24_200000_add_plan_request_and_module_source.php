<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->foreignId('requested_plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->string('requested_cycle', 10)->nullable();
            $table->timestamp('plan_requested_at')->nullable();
        });

        Schema::table('tenant_modules', function (Blueprint $table) {
            $table->string('source', 10)->nullable(); // plan|addon (null = legacy/unknown, treated as addon)
        });
    }

    public function down(): void
    {
        Schema::table('tenant_modules', function (Blueprint $table) {
            $table->dropColumn('source');
        });
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('requested_plan_id');
            $table->dropColumn(['requested_cycle', 'plan_requested_at']);
        });
    }
};
