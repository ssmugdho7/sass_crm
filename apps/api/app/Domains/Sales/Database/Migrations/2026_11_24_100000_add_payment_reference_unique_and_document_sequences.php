<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // NULL references never collide (SQL unique semantics), so manual payments without a reference are unaffected.
        Schema::table('payments', function (Blueprint $table) {
            $table->unique(['tenant_id', 'method', 'reference'], 'payments_tenant_method_reference_unique');
        });

        Schema::create('document_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20); // document prefix: EST, INV, ...
            $table->unsignedBigInteger('next_value');
            $table->timestamps();
            $table->unique(['tenant_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
        // Restore a standalone FK-supporting index before removing its composite replacement.
        if (! Schema::hasIndex('payments', 'payments_tenant_id_rollback_index')) {
            Schema::table('payments', fn (Blueprint $table) => $table->index('tenant_id', 'payments_tenant_id_rollback_index'));
        }
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique('payments_tenant_method_reference_unique');
        });
    }
};
