import {
  catalogSyncMode,
  clampCatalogLimit,
  parseOptionalCount,
  parseOptionalDate,
  toCatalogProduct,
} from './catalog';

describe('catalog sync', () => {
  const since = new Date('2026-01-01T00:00:00.000Z');

  it('downloads the full catalog when the terminal has no cursor', () => {
    expect(
      catalogSyncMode({
        since: null,
        localCount: 10,
        localStockSum: 10,
        sellableCount: 10,
        stockSum: 10,
        changedCount: 0,
      }),
    ).toBe('full');
  });

  it('skips the download when nothing changed and the counts match', () => {
    expect(
      catalogSyncMode({
        since,
        localCount: 4,
        localStockSum: 12,
        sellableCount: 4,
        stockSum: 12,
        changedCount: 0,
      }),
    ).toBe('unchanged');
  });

  it('sends only edits when the product count still matches', () => {
    expect(
      catalogSyncMode({
        since,
        localCount: 4,
        localStockSum: 9,
        sellableCount: 4,
        stockSum: 12,
        changedCount: 1,
      }),
    ).toBe('changes');
  });

  it('downloads everything when the POS is missing products', () => {
    expect(
      catalogSyncMode({
        since,
        localCount: 3,
        localStockSum: 12,
        sellableCount: 4,
        stockSum: 12,
        changedCount: 0,
      }),
    ).toBe('full');
  });

  it('downloads everything when tracked stock drifted without an edit cursor', () => {
    expect(
      catalogSyncMode({
        since,
        localCount: 4,
        localStockSum: 10,
        sellableCount: 4,
        stockSum: 12,
        changedCount: 0,
      }),
    ).toBe('full');
  });

  it('keeps inactive products and a zero cost, and drops archived ones', () => {
    expect(
      toCatalogProduct({
        id: 'p1',
        sku: 'SKU-1',
        name: 'Inactive item',
        price: '15.5',
        cost: 0,
        taxRate: '0.0825',
        status: 'INACTIVE',
        stockQuantity: '3',
        infiniteStock: false,
        deletedAt: null,
      }),
    ).toMatchObject({
      id: 'p1',
      price: 15.5,
      cost: 0,
      taxRate: 0.0825,
      status: 'INACTIVE',
      stockQuantity: 3,
      infiniteStock: false,
    });

    expect(
      toCatalogProduct({
        id: 'p2',
        name: 'Archived',
        deletedAt: '2026-02-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('rejects a bad cursor and clamps the page size', () => {
    expect(parseOptionalDate('not-a-date')).toBeNull();
    expect(parseOptionalDate('2026-03-01T00:00:00.000Z')?.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect(parseOptionalCount('')).toBeNull();
    expect(parseOptionalCount('2.2')).toBe(2);
    expect(clampCatalogLimit('5000')).toBe(1000);
    expect(clampCatalogLimit('1')).toBe(100);
    expect(clampCatalogLimit(undefined)).toBe(500);
  });
});
