import { wholeStockUnits } from '@pos/shared-utils';
import { OrderStatus } from '@pos/shared-types';
import { exchangeShouldRestoreStock, isSaleStatus } from './sale-status';
import {
  capReturnedLines,
  quantitiesStillSold,
  sumStockByProduct,
  toStockUnits,
} from './stock-quantity';

/**
 * In-memory stand-in for adjustTrackedStock. Unlimited products are skipped.
 * The same whole-unit rounding the database update uses is applied here, so
 * these scenarios fail if a stock path starts treating "10" + "5" as "105"
 * or records a different quantity than the shelf.
 */
function move(
  stock: Map<string, number>,
  productId: string,
  delta: number,
  unlimited = false,
) {
  const units = toStockUnits(delta);
  if (!productId || units === 0 || unlimited) return;
  stock.set(productId, (stock.get(productId) ?? 0) + units);
}

function applyLines(
  stock: Map<string, number>,
  lines: Array<{ productId?: string | null; quantity?: unknown }>,
  direction: 1 | -1,
  unlimited: string[] = [],
) {
  const skip = new Set(unlimited);
  for (const [productId, quantity] of sumStockByProduct(lines)) {
    move(stock, productId, direction * quantity, skip.has(productId));
  }
}

function voidSale(
  stock: Map<string, number>,
  status: string,
  sold: Array<{ productId: string; quantity: number }>,
  alreadyReturned: Array<{ productId: string; quantity: number }> = [],
) {
  if (!isSaleStatus(status)) return;
  const lines = alreadyReturned.length
    ? quantitiesStillSold(sold, alreadyReturned)
    : sold;
  applyLines(stock, lines, 1);
}

describe('stock ledger', () => {
  it('keeps only whole units', () => {
    expect(wholeStockUnits(2)).toBe(2);
    expect(wholeStockUnits('10')).toBe(10);
    expect(wholeStockUnits(1.5 * 6)).toBe(9);
    expect(wholeStockUnits(1.4)).toBeNull();
    expect(wholeStockUnits(1.6)).toBeNull();
    expect(wholeStockUnits(0.4)).toBeNull();
    expect(wholeStockUnits('nope')).toBeNull();
  });

  it('adds numeric strings instead of concatenating them', () => {
    const stock = new Map<string, number>([['a', 0]]);
    applyLines(stock, [
      { productId: 'a', quantity: '10' },
      { productId: 'a', quantity: '5' },
    ], 1);
    expect(stock.get('a')).toBe(15);
  });

  it('sells, then voiding the sale puts the same units back', () => {
    const stock = new Map([['a', 20]]);
    applyLines(stock, [{ productId: 'a', quantity: 5 }], -1);
    expect(stock.get('a')).toBe(15);
    voidSale(stock, OrderStatus.SYNCED, [{ productId: 'a', quantity: 5 }]);
    expect(stock.get('a')).toBe(20);
  });

  it('does not put returned units back onto a sale that was already voided or exchanged', () => {
    expect(exchangeShouldRestoreStock({ status: OrderStatus.SYNCED })).toBe(true);
    expect(
      exchangeShouldRestoreStock({
        status: OrderStatus.SYNCED,
        exchangedAt: new Date(),
      }),
    ).toBe(false);
    expect(exchangeShouldRestoreStock({ status: OrderStatus.VOID })).toBe(false);
  });

  it('does not restock a draft that never took stock', () => {
    const stock = new Map([['a', 20]]);
    voidSale(stock, OrderStatus.PENDING, [{ productId: 'a', quantity: 5 }]);
    expect(stock.get('a')).toBe(20);
  });

  it('does not restock more than the sale took out', () => {
    const stock = new Map([['a', 20]]);
    const sold = [{ productId: 'a', quantity: 8 }];
    applyLines(stock, sold, -1);
    const returned = capReturnedLines(sold, [
      { productId: 'a', quantity: 10 },
      { productId: 'other', quantity: 4 },
    ]);
    applyLines(stock, returned, 1);
    expect(returned).toEqual([{ productId: 'a', quantity: 8 }]);
    expect(stock.get('a')).toBe(20);
  });

  it('returns an exchanged sale to its start after the exchange and both voids', () => {
    const stock = new Map([
      ['a', 20],
      ['b', 10],
    ]);
    const sold = [{ productId: 'a', quantity: 8 }];
    applyLines(stock, sold, -1);

    const returned = capReturnedLines(sold, [
      { productId: 'a', quantity: 8, name: 'A' },
      { productId: 'manual-note', quantity: 1, name: 'Note' },
    ]);
    applyLines(
      stock,
      returned.filter((line) => !String(line.productId).startsWith('manual-')),
      1,
    );
    applyLines(stock, [{ productId: 'b', quantity: 3 }], -1);
    expect(stock.get('a')).toBe(20);
    expect(stock.get('b')).toBe(7);

    voidSale(stock, OrderStatus.SYNCED, sold, returned);
    expect(stock.get('a')).toBe(20);

    voidSale(stock, OrderStatus.EXCHANGE, [{ productId: 'b', quantity: 3 }]);
    expect(stock.get('a')).toBe(20);
    expect(stock.get('b')).toBe(10);
  });

  it('moves delivery stock by the difference, then removes it when the delivery is undone', () => {
    const stock = new Map([['a', 4]]);
    applyLines(stock, [], -1);
    applyLines(stock, [{ productId: 'a', quantity: '10' }], 1);
    expect(stock.get('a')).toBe(14);

    const oldTotals = sumStockByProduct([{ productId: 'a', quantity: 10 }]);
    const newTotals = sumStockByProduct([{ productId: 'a', quantity: 4 }]);
    move(stock, 'a', (newTotals.get('a') || 0) - (oldTotals.get('a') || 0));
    expect(stock.get('a')).toBe(8);

    move(stock, 'a', 0 - (newTotals.get('a') || 0));
    expect(stock.get('a')).toBe(4);
  });

  it('rounds a fractional return onto the same units stock moves', () => {
    const stock = new Map([['a', 10]]);
    const stored = toStockUnits(1.6);
    applyLines(stock, [{ productId: 'a', quantity: stored }], -1);
    expect(stored).toBe(2);
    expect(stock.get('a')).toBe(8);

    const edited = toStockUnits(1.4);
    move(stock, 'a', -1 * (edited - stored));
    expect(edited).toBe(1);
    expect(stock.get('a')).toBe(9);
  });

  it('deducts a supplier return, adds a replacement, and reverses both when the return is deleted', () => {
    const stock = new Map([['a', 10], ['b', 3]]);
    applyLines(stock, [{ productId: 'a', quantity: 4 }], -1);
    expect(stock.get('a')).toBe(6);

    const edited = 4 - 1;
    move(stock, 'a', -1 * (1 - 4));
    expect(edited).toBe(3);
    expect(stock.get('a')).toBe(9);

    applyLines(stock, [{ productId: 'b', quantity: 4 }], 1);
    expect(stock.get('b')).toBe(7);

    applyLines(stock, [{ productId: 'b', quantity: 4 }], -1);
    expect(stock.get('b')).toBe(3);

    applyLines(stock, [{ productId: 'a', quantity: 1 }], 1);
    expect(stock.get('a')).toBe(10);
  });

  it('applies a count against the snapshot and keeps sales that happened after the count', () => {
    const stock = new Map([['a', 10]]);
    const snapshot = 10;
    applyLines(stock, [{ productId: 'a', quantity: 1 }], -1);
    const counted = 8;
    const adjustment = toStockUnits(counted) - toStockUnits(snapshot);
    move(stock, 'a', adjustment);
    expect(stock.get('a')).toBe(7);
  });

  it('does not change unlimited products', () => {
    const stock = new Map([['a', 5]]);
    applyLines(stock, [{ productId: 'a', quantity: 3 }], -1, ['a']);
    expect(stock.get('a')).toBe(5);
  });

  it('sums duplicate lines once per product', () => {
    const stock = new Map([['a', 10]]);
    applyLines(
      stock,
      [
        { productId: 'a', quantity: 3 },
        { productId: 'a', quantity: 2 },
      ],
      -1,
    );
    expect(stock.get('a')).toBe(5);
  });
});
