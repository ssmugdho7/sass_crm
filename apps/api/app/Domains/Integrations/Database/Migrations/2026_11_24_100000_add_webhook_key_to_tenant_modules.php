<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant_modules', function (Blueprint $table) {
            // Plain copy of config.webhook_key (config is encrypted) so inbound webhooks can find their tenant.
            $table->string('webhook_key', 64)->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('tenant_modules', function (Blueprint $table) {
            $table->dropUnique(['webhook_key']);
            $table->dropColumn('webhook_key');
        });
    }
};
