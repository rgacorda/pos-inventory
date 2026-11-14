import { calculatePriceBreakdown, pieceSurcharge, withPieceSurcharge } from '@pos/shared-utils';

describe('piece surcharge', () => {
  const product = {
    price: 10,
    packPrice: 100,
    packQuantity: 12,
    halfPackPrice: 55,
    halfPackQuantity: 6,
    convenienceMarkupPercentage: 10,
    convenienceMarkup: 1,
    addonPrice: 2,
  };

  it('charges convenience and refrigeration on every piece, including a pack', () => {
    const surcharge = pieceSurcharge(product, true, true);
    expect(surcharge).toBe(4);
    const priced = withPieceSurcharge(product, surcharge);
    const breakdown = calculatePriceBreakdown(
      12,
      priced.price,
      priced.packPrice,
      priced.packQuantity,
      priced.halfPackPrice,
      priced.halfPackQuantity,
    );
    expect(breakdown.total).toBe(148);
  });

  it('leaves catalog prices alone when neither fee is selected', () => {
    expect(pieceSurcharge(product, false, false)).toBe(0);
    expect(withPieceSurcharge(product, 0)).toBe(product);
  });
});
