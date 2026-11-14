import {
  applyMarkup,
  belowCostPricingMessage,
  changeExternalUnitCost,
  changeTierMarkup,
  changeTierPrice,
  changeTierQuantity,
  changeUnitCost,
  deliveryPriceOverrides,
  EMPTY_TIER_PRICING,
  KEEP_SAVED_PRICES,
  TRACK_COST,
} from '@pos/shared-utils';

describe('tier markup', () => {
  it('adds a percent and a fixed amount to the tier cost', () => {
    expect(applyMarkup(10, 20, 1.5)).toBe(13.5);
    expect(applyMarkup(120, 10, 5)).toBe(137);
    expect(applyMarkup(10, 0, 0)).toBe(10);
  });

  it('rounds the sell price to centavos', () => {
    expect(applyMarkup(10.1, 10, 0)).toBe(11.11);
    expect(applyMarkup(3.33 * 3, 0, 0)).toBe(9.99);
  });

  it('fills blank prices from cost and keeps following cost changes', () => {
    const started = changeUnitCost(EMPTY_TIER_PRICING, TRACK_COST, '10');
    expect(started.fields.price).toBe('10.00');

    const withPack = changeTierQuantity(
      started.fields,
      started.manual,
      'pack',
      '12',
      10,
    );
    expect(withPack.fields.packPrice).toBe('120.00');

    const raised = changeUnitCost(withPack.fields, withPack.manual, '11');
    expect(raised.fields.price).toBe('11.00');
    expect(raised.fields.packPrice).toBe('132.00');
  });

  it('applies pack and half-pack markup on top of quantity times unit cost', () => {
    const base = changeUnitCost(
      { ...EMPTY_TIER_PRICING, packQuantity: '12', halfPackQuantity: '6' },
      TRACK_COST,
      '10',
    );
    const pack = changeTierMarkup(
      base.fields,
      base.manual,
      'pack',
      'percentage',
      '10',
      10,
    );
    const half = changeTierMarkup(
      pack.fields,
      pack.manual,
      'halfPack',
      'fixed',
      '3',
      10,
    );

    expect(half.fields.packPrice).toBe('132.00');
    expect(half.fields.halfPackPrice).toBe('63.00');
  });

  it('keeps a typed price until markup or quantity changes', () => {
    const priced = changeTierPrice(
      { ...EMPTY_TIER_PRICING, cost: '10', price: '10.00' },
      TRACK_COST,
      'unit',
      '25',
    );
    const costChanged = changeExternalUnitCost(priced.fields, priced.manual, 12);
    expect(costChanged.fields.price).toBe('25');

    const markedUp = changeTierMarkup(
      costChanged.fields,
      costChanged.manual,
      'unit',
      'percentage',
      '20',
      12,
    );
    expect(markedUp.fields.price).toBe('14.40');
  });

  it('recalculates a saved price when that tier has a markup and the cost changes', () => {
    const fields = {
      ...EMPTY_TIER_PRICING,
      cost: '10',
      price: '15.00',
      markupPercentage: '20',
      packQuantity: '12',
      packPrice: '150.00',
    };
    const changed = changeExternalUnitCost(fields, KEEP_SAVED_PRICES, 11);
    expect(changed.fields.price).toBe('13.20');
    expect(changed.fields.packPrice).toBe('150.00');
  });

  it('does not add markup on top of a price that was typed', () => {
    const typed = changeTierPrice(
      {
        ...EMPTY_TIER_PRICING,
        cost: '10',
        packQuantity: '12',
        packPrice: '120.00',
        packMarkupPercentage: '10',
      },
      TRACK_COST,
      'pack',
      '150',
    );
    const marked = changeTierMarkup(
      typed.fields,
      typed.manual,
      'pack',
      'percentage',
      '10',
      10,
    );
    expect(marked.fields.packPrice).toBe('132.00');
  });

  it('keeps the sell price when markup is cleared', () => {
    const fields = {
      ...EMPTY_TIER_PRICING,
      cost: '10',
      price: '15.00',
      markupPercentage: '20',
    };
    const cleared = changeTierMarkup(fields, TRACK_COST, 'unit', 'percentage', '', 10);
    expect(cleared.fields.price).toBe('15.00');
    expect(cleared.manual.unit).toBe(true);
  });

  it('clears a pack price when the pack quantity is removed', () => {
    const fields = {
      ...EMPTY_TIER_PRICING,
      packQuantity: '12',
      packPrice: '120.00',
    };
    const cleared = changeTierQuantity(fields, KEEP_SAVED_PRICES, 'pack', '', 10);
    expect(cleared.fields.packPrice).toBe('');
  });

  it('rejects a sell price below cost and allows zero profit', () => {
    expect(
      belowCostPricingMessage({
        ...EMPTY_TIER_PRICING,
        cost: '10',
        price: '10.00',
        packQuantity: '12',
        packPrice: '120.00',
      }),
    ).toBeNull();

    expect(
      belowCostPricingMessage({
        ...EMPTY_TIER_PRICING,
        cost: '10',
        price: '9.99',
      }),
    ).toMatch(/Unit price cannot be below cost/);

    expect(
      belowCostPricingMessage({
        ...EMPTY_TIER_PRICING,
        cost: '10',
        price: '10.00',
        halfPackQuantity: '6',
        halfPackPrice: '50.00',
      }),
    ).toMatch(/Half-pack price/);
  });

  it('sends null when a pack or markup is cleared', () => {
    const overrides = deliveryPriceOverrides({
      ...EMPTY_TIER_PRICING,
      price: '15',
      packQuantity: '',
      packPrice: '',
      halfPackQuantity: '6',
      halfPackMarkupPercentage: '5',
      halfPackPrice: '63',
    });

    expect(overrides.priceOverride).toBe(15);
    expect(overrides.packQuantityOverride).toBeNull();
    expect(overrides.packPriceOverride).toBeNull();
    expect(overrides.markupPercentage).toBeNull();
    expect(overrides.halfPackQuantityOverride).toBe(6);
    expect(overrides.halfPackMarkupPercentage).toBe(5);
    expect(overrides.halfPackPriceOverride).toBe(63);
  });
});
