import {
  averageRecentPurchases,
  suggestedPurchaseQuantity,
} from '@pos/shared-utils';

const day = (iso: string) => iso;

describe('average recent purchases', () => {
  it('averages one purchase per delivery and keeps only the newest window', () => {
    const events = Array.from({ length: 9 }, (_, index) => ({
      productId: 'prod-1',
      deliveryId: `del-${index}`,
      deliveryDate: day(`2026-01-${String(index + 1).padStart(2, '0')}`),
      quantity: index === 0 ? 100 : 10,
    }));

    const [average] = averageRecentPurchases(events, 8);

    expect(average.averageQuantity).toBe(10);
    expect(average.deliveryCount).toBe(8);
    expect(average.lastQuantity).toBe(10);
    expect(average.lastDeliveryDate).toContain('2026-01-09');
  });

  it('sums split lines on the same delivery before averaging', () => {
    const [average] = averageRecentPurchases([
      {
        productId: 'prod-1',
        deliveryId: 'del-1',
        deliveryDate: '2026-03-01',
        quantity: 6,
      },
      {
        productId: 'prod-1',
        deliveryId: 'del-1',
        deliveryDate: '2026-03-01',
        quantity: 6,
      },
      {
        productId: 'prod-1',
        deliveryId: 'del-2',
        deliveryDate: '2026-04-01',
        quantity: 24,
      },
    ]);

    expect(average.averageQuantity).toBe(18);
    expect(average.deliveryCount).toBe(2);
    expect(average.lastQuantity).toBe(24);
  });

  it('breaks a same-day tie by when the delivery was recorded', () => {
    const [average] = averageRecentPurchases(
      [
        {
          productId: 'prod-1',
          deliveryId: 'earlier',
          deliveryDate: '2026-05-01',
          createdAt: '2026-05-01T01:00:00.000Z',
          quantity: 4,
        },
        {
          productId: 'prod-1',
          deliveryId: 'later',
          deliveryDate: '2026-05-01',
          createdAt: '2026-05-01T05:00:00.000Z',
          quantity: 8,
        },
      ],
      1,
    );

    expect(average.lastQuantity).toBe(8);
    expect(average.deliveryCount).toBe(1);
    expect(average.averageQuantity).toBe(8);
  });

  it('drops empty quantities', () => {
    expect(
      averageRecentPurchases([
        {
          productId: 'prod-1',
          deliveryId: 'del-1',
          deliveryDate: '2026-05-01',
          quantity: 0,
        },
      ]),
    ).toEqual([]);
  });
});

describe('suggested purchase quantity', () => {
  const packed = { packQuantity: 12, halfPackQuantity: 6 };

  it('suggests packs when the average is a pack', () => {
    expect(suggestedPurchaseQuantity(24, packed)).toEqual({
      quantity: 2,
      quantityType: 'PACK',
    });
  });

  it('suggests half packs when that is closer than a full pack', () => {
    expect(suggestedPurchaseQuantity(18, packed)).toEqual({
      quantity: 3,
      quantityType: 'HALF_PACK',
    });
    expect(suggestedPurchaseQuantity(6, packed)).toEqual({
      quantity: 1,
      quantityType: 'HALF_PACK',
    });
  });

  it('suggests loose units when a pack would over-order', () => {
    expect(suggestedPurchaseQuantity(4, packed)).toEqual({
      quantity: 4,
      quantityType: 'UNIT',
    });
  });

  it('suggests whole units when the product has no pack size', () => {
    expect(suggestedPurchaseQuantity(7.4)).toEqual({
      quantity: 7,
      quantityType: 'UNIT',
    });
  });
});
