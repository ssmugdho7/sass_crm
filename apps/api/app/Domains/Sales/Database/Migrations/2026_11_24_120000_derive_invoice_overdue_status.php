<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** "overdue" is now derived from due_date only; legacy manually-marked rows revert to "sent" (or their payment state). */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('invoices')->where('status', 'overdue')->update([
            'status' => DB::raw("CASE WHEN amount_paid > 0 AND amount_paid >= total THEN 'paid' WHEN amount_paid > 0 THEN 'partial' ELSE 'sent' END"),
        ]);
    }

    public function down(): void
    {
        // Not reversible: the previous manual flag is indistinguishable from "sent".
    }
};
