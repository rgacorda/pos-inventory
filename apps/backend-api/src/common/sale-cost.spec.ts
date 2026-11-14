import {
  moneyCost,
  recordedUnitCost,
  stampReturnUnitCosts,
  unitCostByProduct,
  unitCostForProduct,
} from './sale-cost';

describe('sale unit cost', () => {
  it('keeps a zero cost and rejects a missing or negative one', () => {
    expect(moneyCost(0)).toBe(0);
    expect(moneyCost('12.345')).toBe(12.35);
    expect(moneyCost(null)).toBeNull();
    expect(moneyCost('')).toBeNull();
    expect(moneyCost(-1)).toBeNull();
    expect(moneyCost('nope')).toBeNull();
  });

  it('weights the cost of two lines of the same product and skips lines with no cost', () => {
    const costs = unitCostByProduct([
      { productId: 'a', quantity: 1, unitCost: 10 },
      { productId: 'a', quantity: 3, unitCost: '20' },
      { productId: 'a', quantity: 5, unitCost: null },
      { productId: 'manual-1', quantity: 2, unitCost: 4 },
      { productId: 'b', quantity: 2, unitCost: 0 },
    ]);

    expect(costs.get('a')).toBe(17.5);
    expect(costs.get('b')).toBe(0);
    expect(costs.has('manual-1')).toBe(false);
  });

  it('uses the cost captured on the register, then the product cost', () => {
    const catalog = new Map<string, number | null>([
      ['a', 40],
      ['b', null],
    ]);

    expect(recordedUnitCost('a', 33, catalog)).toBe(33);
    expect(recordedUnitCost('a', undefined, catalog)).toBe(40);
    expect(recordedUnitCost('a', 0, catalog)).toBe(0);
    expect(recordedUnitCost('b', undefined, catalog)).toBeNull();
    expect(recordedUnitCost('missing', undefined, catalog)).toBeNull();
    expect(recordedUnitCost('manual-9', 5, catalog)).toBeNull();
    expect(unitCostForProduct('a', catalog)).toBe(40);
  });

  it('copies the original sale cost onto each returned line', () => {
    const stamped = stampReturnUnitCosts(
      [
        { productId: 'a', quantity: 1, unitPrice: 100 },
        { productId: 'gone', quantity: 1, unitPrice: 50 },
      ],
      new Map([['a', 40]]),
    );

    expect(stamped[0]).toEqual({
      productId: 'a',
      quantity: 1,
      unitPrice: 100,
      unitCost: 40,
    });
    expect(stamped[1]).toEqual({
      productId: 'gone',
      quantity: 1,
      unitPrice: 50,
    });
  });
});
