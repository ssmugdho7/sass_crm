<?php

namespace Tests\Feature\Sales;

use App\Domains\Sales\Actions\NextDocumentNumber;
use App\Domains\Sales\Actions\RecordPayment;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/** Separate committed connections are required; RefreshDatabase's wrapping transaction cannot test locks. */
class DatabaseLockingTest extends TestCase
{
    use DatabaseMigrations;

    protected $seed = true;

    protected function beforeRefreshingDatabase(): void
    {
        if (config('database.default') !== 'mysql' || ! function_exists('pcntl_fork')) {
            $this->markTestSkipped('Run on isolated MySQL with pcntl to exercise real row locks.');
        }
        if (! str_ends_with((string) config('database.connections.mysql.database'), '_test')) {
            $this->markTestSkipped('Concurrency checks require an explicitly named *_test database.');
        }
    }

    public function test_real_connections_serialize_payments_and_first_document_numbers(): void
    {
        $tenantId = User::where('email', 'owner@demo.test')->firstOrFail()->tenant_id;
        $customer = Customer::withoutGlobalScope('tenant')->forceCreate(['tenant_id' => $tenantId, 'name' => 'Lock test']);
        $invoice = Invoice::withoutGlobalScope('tenant')->forceCreate([
            'tenant_id' => $tenantId, 'customer_id' => $customer->id, 'number' => 'INV-0001',
            'public_token' => 'mysql-lock-test', 'status' => 'sent', 'issue_date' => today(), 'items' => [], 'total' => 1000, 'amount_paid' => 0,
        ]);
        $results = $this->concurrent(function (Invoice $snapshot): string {
            try {
                app(RecordPayment::class)($snapshot, 750, 'cash', rejectOverpayment: true);

                return 'accepted';
            } catch (ValidationException) {
                return 'rejected';
            }
        }, $invoice->id);
        sort($results);
        $this->assertSame(['accepted', 'rejected'], $results);
        $this->assertSame(750, (int) $invoice->fresh()->amount_paid);

        $numbers = $this->concurrent(fn () => app(NextDocumentNumber::class)(Invoice::class, 'INV', $tenantId));
        sort($numbers);
        $this->assertSame(['INV-0002', 'INV-0003'], $numbers);
    }

    /** @return list<string> */
    private function concurrent(callable $work, ?int $invoiceId = null): array
    {
        $directory = sys_get_temp_dir().'/buildcrm-lock-'.bin2hex(random_bytes(8));
        mkdir($directory, 0700);
        DB::purge();
        $children = [];
        try {
            foreach ([0, 1] as $index) {
                $pid = pcntl_fork();
                $this->assertNotSame(-1, $pid, 'Unable to fork the independent database client.');
                if ($pid === 0) {
                    try {
                        // Both snapshots are loaded before releasing the workers at the same time.
                        $snapshot = $invoiceId ? Invoice::withoutGlobalScope('tenant')->findOrFail($invoiceId) : null;
                        file_put_contents($directory.'/ready-'.$index, 'ready');
                        $deadline = microtime(true) + 10;
                        while (! file_exists($directory.'/start')) {
                            if (microtime(true) > $deadline) {
                                throw new \RuntimeException('Timed out waiting for the concurrency barrier.');
                            }
                            usleep(10000);
                        }
                        file_put_contents($directory.'/result-'.$index, json_encode(['value' => $work($snapshot)]));
                        exit(0);
                    } catch (\Throwable $error) {
                        file_put_contents($directory.'/result-'.$index, json_encode(['error' => $error->getMessage()]));
                        exit(1);
                    }
                }
                $children[] = $pid;
            }
            $deadline = microtime(true) + 10;
            while (! file_exists($directory.'/ready-0') || ! file_exists($directory.'/ready-1')) {
                $this->assertLessThan($deadline, microtime(true), 'Database clients did not reach the barrier.');
                usleep(10000);
            }
            touch($directory.'/start');
            $results = [];
            foreach ($children as $index => $pid) {
                pcntl_waitpid($pid, $status);
                $result = json_decode(file_get_contents($directory.'/result-'.$index), true);
                $this->assertSame(0, pcntl_wexitstatus($status), $result['error'] ?? 'Client failed.');
                $results[] = $result['value'];
            }

            return $results;
        } finally {
            touch($directory.'/start');
            foreach ($children as $pid) {
                pcntl_waitpid($pid, $status);
            }
            foreach (glob($directory.'/*') as $file) {
                unlink($file);
            }
            rmdir($directory);
            DB::purge();
        }
    }
}
