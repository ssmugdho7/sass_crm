<?php

namespace App\Domains\Sales\Actions;

/**
 * Normalises line items and computes subtotal / tax / total in integer cents.
 * Line amount = quantity × unit_price, tax = subtotal × rate%, each rounded half up.
 */
class CalculateTotals
{
    /**
     * @param  array<int, array{description?:string, quantity?:int|float|string, unit_price?:int|string}>  $items
     * @return array{items: list<array{description:string, quantity:float|int, unit_price:int, amount:int}>, subtotal:int, tax:int, total:int}
     */
    public function __invoke(array $items, float|int|string|null $taxRate): array
    {
        $lines = [];
        $subtotal = 0;
        foreach ($items as $item) {
            $qty = (float) ($item['quantity'] ?? 0);
            $qty = floor($qty) == $qty ? (int) $qty : round($qty, 2);
            $price = (int) ($item['unit_price'] ?? 0);
            $amount = (int) round($qty * $price, 0, PHP_ROUND_HALF_UP);
            $subtotal += $amount;
            $lines[] = ['description' => trim((string) ($item['description'] ?? '')), 'quantity' => $qty, 'unit_price' => $price, 'amount' => $amount];
        }
        $tax = (int) round($subtotal * (float) ($taxRate ?? 0) / 100, 0, PHP_ROUND_HALF_UP);

        return ['items' => $lines, 'subtotal' => $subtotal, 'tax' => $tax, 'total' => $subtotal + $tax];
    }
}
