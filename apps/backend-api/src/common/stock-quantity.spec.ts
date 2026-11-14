import { quantitiesStillSold, sumStockByProduct, toStockUnits } from './stock-quantity';

describe('stock quantity units', () => {
  it('rounds finite numbers and ignores junk', () => {
    expect(toStockUnits(10)).toBe(10);
    expect(toStockUnits('10')).toBe(10);
    expect(toStockUnits('10.6')).toBe(11);
    expect(toStockUnits(-2.2)).toBe(-2);
    expect(toStockUnits('nope')).toBe(0);
    expect(toStockUnits(null)).toBe(0);
  });

  it('adds quantities as numbers, including numeric strings', () => {
    const totals = sumStockByProduct([
      { productId: 'a', quantity: '10' },
      { productId: 'a', quantity: 5 },
      { productId: 'b', quantity: '4' },
      { productId: 'c', quantity: 0 },
      { productId: '', quantity: 8 },
    ]);

    expect(totals.get('a')).toBe(15);
    expect(totals.get('b')).toBe(4);
    expect(totals.has('c')).toBe(false);
  });

  it('does not restore pieces an exchange already put back', () => {
    expect(
      quantitiesStillSold(
        [
          { productId: 'a', quantity: 10 },
          { productId: 'b', quantity: 2 },
        ],
        [{ productId: 'a', quantity: 3 }],
      ),
    ).toEqual([
      { productId: 'a', quantity: 7 },
      { productId: 'b', quantity: 2 },
    ]);
  });
});
