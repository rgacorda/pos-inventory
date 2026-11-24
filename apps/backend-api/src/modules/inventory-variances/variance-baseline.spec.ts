import { resolvePendingBaseline } from './inventory-variances.service';

describe('variance baseline while the store is open', () => {
  it('keeps the stock the counter saw when the count is saved again', () => {
    expect(resolvePendingBaseline(20, 26, 26)).toBe(20);
  });

  it('stores the stock on screen for a new count, not the stock at save time', () => {
    expect(resolvePendingBaseline(null, 20, 26)).toBe(20);
  });

  it('uses the live stock only when the screen did not send a baseline', () => {
    expect(resolvePendingBaseline(null, undefined, 26)).toBe(26);
  });

  it('applies the original difference after sales and a delivery', () => {
    const baseline = resolvePendingBaseline(null, 20, 20);
    const counted = 18;
    const afterSaleAndDelivery = 20 - 4 + 10;
    expect(afterSaleAndDelivery + (counted - baseline)).toBe(24);
  });
});
