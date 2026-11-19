import { readFileSync } from 'fs';
import { join } from 'path';
import { OrderStatus, PaymentMethod } from '@pos/shared-types';
import {
  applyAmountDueRounding,
  applyMarkup,
  calculateEffectivePrice,
  calculateLineSubtotal,
  calculateOrderTotal,
  calculatePriceBreakdown,
  calculateTax,
  catalogPricingIssues,
  pieceSurcharge,
  roundMoney,
  validateOrder,
  validatePayment,
  wholeStockUnits,
  withPieceSurcharge,
} from '@pos/shared-utils';
import { toCatalogProduct, catalogSyncMode } from '../sync/catalog';
import { isNewestCostUpdate } from './delivery-cost';
import {
  moneyCost,
  recordedUnitCost,
  stampReturnUnitCosts,
  unitCostByProduct,
  FROZEN_RETURN_UNIT_COST_SQL,
} from './sale-cost';
import { ledgerMoney, settleSaleLine } from './sale-line';
import { SALE_STATUSES, SALE_STATUS_SQL, isSaleStatus } from './sale-status';
import {
  capReturnedLines,
  quantitiesStillSold,
  sumStockByProduct,
  toStockUnits,
} from './stock-quantity';

function source(relativeToCommon: string): string {
  return readFileSync(join(__dirname, relativeToCommon), 'utf8');
}

function statusLists(src: string): string[] {
  return [...src.matchAll(/status"::text IN \(([^)]+)\)/g)].map((match) =>
    match[1].replace(/\s/g, ''),
  );
}

interface RegisterLine {
  productId: string;
  quantity: number;
  price: number;
  cost?: number;
  taxRate?: number;
  packPrice?: number;
  packQuantity?: number;
  halfPackPrice?: number;
  halfPackQuantity?: number;
}

/**
 * The same charge the POS register builds: tiered prices, tax on the line
 * subtotal, points and exchange credit, then optional peso round-up folded
 * into the last line.
 */
function registerCharge(input: {
  lines: RegisterLine[];
  exchangeCredit?: number;
  points?: number;
  usePoints?: boolean;
  roundUp?: boolean;
}) {
  const priced = input.lines.map((item) => {
    const breakdown = calculatePriceBreakdown(
      item.quantity,
      item.price,
      item.packPrice,
      item.packQuantity,
      item.halfPackPrice,
      item.halfPackQuantity,
    );
    const subtotal = breakdown.total;
    const unitPrice = calculateEffectivePrice(
      item.quantity,
      item.price,
      item.packPrice,
      item.packQuantity,
      item.halfPackPrice,
      item.halfPackQuantity,
    );
    const tax = subtotal * (item.taxRate || 0);
    return { item, subtotal, unitPrice, tax };
  });
  const exactSubtotal = priced.reduce((sum, line) => sum + line.subtotal, 0);
  const tax = priced.reduce((sum, line) => sum + line.tax, 0);
  const exactGross = exactSubtotal + tax;
  const pointsRedeemed = input.usePoints
    ? Math.min(input.points ?? 0, Math.floor(exactGross))
    : 0;
  const exchangeCredit = input.exchangeCredit ?? 0;
  const rawAmountDue = Math.max(0, exactGross - exchangeCredit - pointsRedeemed);
  const roundUp = input.roundUp !== false;
  const amountDue = applyAmountDueRounding(rawAmountDue, roundUp);
  const roundingAdjustment = Number((amountDue - rawAmountDue).toFixed(2));
  if (roundingAdjustment !== 0 && priced.length > 0) {
    const target = priced[priced.length - 1];
    target.subtotal = Number((target.subtotal + roundingAdjustment).toFixed(2));
    target.unitPrice =
      target.item.quantity > 0
        ? Number((target.subtotal / target.item.quantity).toFixed(2))
        : target.subtotal;
  }
  const creditApplied = Math.min(exchangeCredit, exactGross);
  const finalTotal = applyAmountDueRounding(
    Math.max(0, exactGross - creditApplied - pointsRedeemed),
    roundUp,
  );
  const items = priced.map((line) => {
    const rawCost = line.item.cost;
    const unitCost =
      rawCost != null && Number.isFinite(rawCost) && rawCost >= 0
        ? ledgerMoney(rawCost)
        : undefined;
    return {
      productId: line.item.productId,
      quantity: line.item.quantity,
      unitPrice: line.unitPrice,
      ...(unitCost != null ? { unitCost } : {}),
      taxRate: line.item.taxRate || 0,
      discountAmount: 0,
      subtotal: line.subtotal,
      total: line.subtotal + line.tax,
    };
  });
  return {
    items,
    subtotal: priced.reduce((sum, line) => sum + line.subtotal, 0),
    taxAmount: tax,
    discountAmount: creditApplied + pointsRedeemed,
    totalAmount: finalTotal,
    pointsEarned: Math.floor(finalTotal / 500),
  };
}

function booksOf(charge: ReturnType<typeof registerCharge>) {
  return charge.items.map((item) => settleSaleLine(item));
}

describe('system consistency', () => {
  describe('money rounding', () => {
    it('agrees with the shared centavo rounder on every whole centavo up to 1000', () => {
      const mismatches: number[] = [];
      for (let cents = 0; cents <= 100_000; cents += 1) {
        const amount = cents / 100;
        if (roundMoney(amount) !== ledgerMoney(amount)) mismatches.push(amount);
      }
      expect(mismatches).toEqual([]);
    });

    it('keeps a recorded zero cost and drops a missing one', () => {
      expect(moneyCost(0)).toBe(0);
      expect(ledgerMoney(0)).toBe(0);
      expect(moneyCost(null)).toBeNull();
      expect(moneyCost(-1)).toBeNull();
    });

    it('prices a catalog row with the same centavos the ledger uses', () => {
      const product = toCatalogProduct({
        id: 'p1',
        price: 10.126,
        cost: 0,
        stockQuantity: 1.6,
        status: 'INACTIVE',
      });
      expect(product?.price).toBe(ledgerMoney(10.126));
      expect(product?.cost).toBe(0);
      expect(product?.stockQuantity).toBe(toStockUnits(1.6));
    });
  });

  describe('stock units', () => {
    it('accepts the same whole units the shelf movement rounds to', () => {
      for (const value of [0, 1, 2, 10, '10', 1.5 * 6, 9.0004]) {
        const accepted = wholeStockUnits(value);
        expect(accepted).not.toBeNull();
        expect(toStockUnits(value)).toBe(accepted);
      }
    });

    it('rejects a fractional count before it can be rounded onto the shelf', () => {
      expect(wholeStockUnits(1.4)).toBeNull();
      expect(wholeStockUnits(1.6)).toBeNull();
      expect(toStockUnits(1.6)).toBe(2);
    });
  });

  describe('sale statuses', () => {
    it('counts completed, synced, and exchange sales, and nothing else', () => {
      expect(SALE_STATUSES).toEqual([
        OrderStatus.COMPLETED,
        OrderStatus.SYNCED,
        OrderStatus.EXCHANGE,
      ]);
      expect(SALE_STATUS_SQL.replace(/\s/g, '')).toBe(
        "'COMPLETED','SYNCED','EXCHANGE'",
      );
      expect(isSaleStatus(OrderStatus.PENDING)).toBe(false);
      expect(isSaleStatus(OrderStatus.VOID)).toBe(false);
      expect(isSaleStatus(OrderStatus.EXCHANGE)).toBe(true);
      expect(FROZEN_RETURN_UNIT_COST_SQL).toContain('order_items');
      expect(FROZEN_RETURN_UNIT_COST_SQL).not.toContain('products');
    });

    it('uses that same list in financials, and the shared SQL in the other reports', () => {
      const expected = SALE_STATUS_SQL.replace(/\s/g, '');
      const financials = source('../modules/financials/financials.service.ts');
      const dashboard = source('../modules/orders/dashboard-stats.ts');
      const orders = source('../modules/orders/orders.service.ts');

      expect(financials).toContain('const REVENUE_STATUSES = SALE_STATUSES');
      expect(statusLists(financials)).toEqual([expected]);
      expect(dashboard).toContain('SALE_STATUS_SQL');
      expect(orders).toContain('SALE_STATUS_SQL');
      for (const src of [financials, dashboard, orders]) {
        expect(src).toContain('manual-%');
        expect(src).toContain('FROZEN_RETURN_UNIT_COST_SQL');
        expect(src).toContain("<> 'VOID'");
      }
    });

    it('does not treat a stored zero cost as a missing cost', () => {
      const financials = source('../modules/financials/financials.service.ts');
      expect(financials).toContain('WHEN i."unitCost" IS NULL THEN 1');
      expect(financials).not.toContain('i."unitCost" = 0 THEN 1');
    });
  });

  describe('register charge and the books', () => {
    it('keeps a pack-plus-piece total that quantity times the rounded unit price would lose', () => {
      const charge = registerCharge({
        roundUp: false,
        lines: [
          {
            productId: 'soap',
            quantity: 13,
            price: 10,
            cost: 8,
            packPrice: 100,
            packQuantity: 12,
          },
        ],
      });
      const [line] = booksOf(charge);
      const rebuilt = ledgerMoney(13 * ledgerMoney(charge.items[0].unitPrice));

      expect(charge.items[0].subtotal).toBe(110);
      expect(line.subtotal).toBe(110);
      expect(rebuilt).toBe(109.98);
      expect(line.subtotal).not.toBe(rebuilt);
      expect(
        ledgerMoney(line.subtotal + charge.taxAmount - charge.discountAmount),
      ).toBe(charge.totalAmount);
    });

    it('folds peso round-up into the last line and still charges that amount', () => {
      const charge = registerCharge({
        lines: [
          { productId: 'a', quantity: 1, price: 10.2, cost: 4 },
          { productId: 'b', quantity: 2, price: 3.15, cost: 1 },
        ],
      });
      const settled = booksOf(charge);
      const goods = ledgerMoney(
        settled.reduce((sum, line) => sum + line.subtotal, 0),
      );

      expect(charge.totalAmount).toBe(Math.ceil(10.2 + 6.3));
      expect(goods).toBe(charge.subtotal);
      expect(ledgerMoney(goods - charge.discountAmount)).toBe(charge.totalAmount);
    });

    it('charges convenience on every piece inside a pack', () => {
      const product = {
        price: 10,
        packPrice: 100,
        packQuantity: 12,
        convenienceMarkupPercentage: 10,
        convenienceMarkup: 1,
        addonPrice: 2,
      };
      const surcharge = pieceSurcharge(product, true, true);
      const priced = withPieceSurcharge(product, surcharge);
      const breakdown = calculatePriceBreakdown(
        12,
        priced.price,
        priced.packPrice,
        priced.packQuantity,
      );
      expect(surcharge).toBe(4);
      expect(breakdown.total).toBe(148);
      expect(calculateEffectivePrice(12, priced.price, priced.packPrice, 12) * 12).toBe(
        breakdown.total,
      );
    });

    it('prices a tier from cost, percent, and a fixed amount', () => {
      expect(applyMarkup(10 * 12, 10, 5)).toBe(137);
      expect(calculateLineSubtotal(2, 10)).toBe(20);
      expect(calculateTax(20, 0.12)).toBe(2.4);
      expect(calculateOrderTotal(20, 2.4, 0)).toBe(22.4);
    });

    it('sends the receipt subtotal and total when the register has them', () => {
      const client = source('../../../pos/src/lib/api-client.ts');
      expect(client).toContain('subtotal: this.money(item.subtotal)');
      expect(client).toContain('total: this.money(item.total)');
      const orders = source('../modules/orders/orders.service.ts');
      const sync = source('../sync/sync.service.ts');
      expect(orders).toContain('settleSaleLine');
      expect(sync).toContain('settleSaleLine');
    });

    it('rebuilds a line from quantity and price only when the receipt omitted the subtotal', () => {
      expect(
        settleSaleLine({ quantity: '2.4', unitPrice: '10.005', taxRate: 0.12 }),
      ).toEqual({
        quantity: 2,
        unitPrice: 10.01,
        discountAmount: 0,
        taxRate: 0.12,
        subtotal: 20.02,
        total: 22.42,
      });
    });

    it('rejects an order or a payment that cannot be posted', () => {
      const order = validateOrder({
        posLocalId: '',
        terminalId: 't',
        cashierId: 'c',
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        completedAt: new Date(),
      });
      expect(order.valid).toBe(false);
      const payment = validatePayment({
        posLocalId: 'p',
        orderId: 'order-1',
        orderPosLocalId: 'local-1',
        terminalId: 't',
        amount: 0,
        method: PaymentMethod.CASH,
        processedAt: new Date(),
      });
      expect(payment.valid).toBe(false);
    });
  });

  describe('profit, cost, and stock for one shop day', () => {
    const sale = registerCharge({
      roundUp: false,
      lines: [
        { productId: 'soap', quantity: 2, price: 10, cost: 4 },
        { productId: 'manual-note', quantity: 1, price: 15, cost: 0 },
      ],
    });
    const settled = booksOf(sale);

    it('takes revenue from the amount charged and cost from tracked lines only', () => {
      const revenue = ledgerMoney(sale.totalAmount);
      const soldCost = ledgerMoney(
        sale.items.reduce((sum, item, index) => {
          if (item.productId.startsWith('manual-')) return sum;
          return sum + settled[index].quantity * (item.unitCost ?? 0);
        }, 0),
      );
      expect(revenue).toBe(35);
      expect(soldCost).toBe(8);
      expect(ledgerMoney(revenue - soldCost)).toBe(27);
    });

    it('flags a line sold under its saved cost and an order that collected less than cost', () => {
      const cheap = registerCharge({
        roundUp: false,
        lines: [{ productId: 'soap', quantity: 1, price: 5, cost: 8 }],
      });
      const [line] = booksOf(cheap);
      expect(line.unitPrice).toBeLessThan(8);
      expect(ledgerMoney(8 - line.unitPrice)).toBe(3);
      expect(cheap.totalAmount + 0.009).toBeLessThan(8);
      expect(ledgerMoney(cheap.totalAmount - 8)).toBe(-3);
    });

    it('costs a return from the sale that was saved after the catalog cost changes', () => {
      const original = unitCostByProduct([
        { productId: 'soap', quantity: 2, unitCost: 4 },
      ]);
      const returned = stampReturnUnitCosts(
        [{ productId: 'soap', quantity: 1, unitPrice: 10 }],
        original,
      );
      const laterCatalog = new Map<string, number | null>([['soap', 9]]);
      expect(returned[0].unitCost).toBe(4);
      expect(recordedUnitCost('soap', returned[0].unitCost, laterCatalog)).toBe(4);
      expect(recordedUnitCost('soap', undefined, laterCatalog)).toBe(9);
    });

    it('sells, returns part, and voids the rest back to the starting shelf', () => {
      const stock = new Map([['soap', 20]]);
      const sold = [{ productId: 'soap', quantity: 8 }];
      for (const [productId, quantity] of sumStockByProduct(sold)) {
        stock.set(productId, (stock.get(productId) ?? 0) - quantity);
      }
      const returned = capReturnedLines(sold, [
        { productId: 'soap', quantity: 3 },
        { productId: 'other', quantity: 2 },
        { productId: 'manual-note', quantity: 1 },
      ]);
      for (const line of returned) {
        if (String(line.productId).startsWith('manual-')) continue;
        stock.set(
          line.productId,
          (stock.get(line.productId) ?? 0) + Number(line.quantity),
        );
      }
      expect(stock.get('soap')).toBe(15);
      const stillOut = quantitiesStillSold(sold, returned);
      expect(stillOut).toEqual([{ productId: 'soap', quantity: 5 }]);
      for (const line of stillOut) {
        stock.set(line.productId, (stock.get(line.productId) ?? 0) + line.quantity);
      }
      expect(stock.get('soap')).toBe(20);
    });

    it('leaves a draft and a void out of revenue', () => {
      const rows = [
        { status: OrderStatus.COMPLETED, paid: 10 },
        { status: OrderStatus.SYNCED, paid: 5 },
        { status: OrderStatus.EXCHANGE, paid: 4 },
        { status: OrderStatus.PENDING, paid: 100 },
        { status: OrderStatus.VOID, paid: 80 },
      ];
      const revenue = ledgerMoney(
        rows
          .filter((row) => isSaleStatus(row.status))
          .reduce((sum, row) => sum + row.paid, 0),
      );
      expect(revenue).toBe(19);
    });

    it('suggests a per-piece cost when the saved cost is the pack price', () => {
      const issues = catalogPricingIssues({
        cost: 120,
        price: 10,
        packQuantity: 12,
        packPrice: 120,
      });
      expect(issues[0]?.label).toBe('Unit');
      expect(issues[0]?.action).toContain('10.00 per piece');
    });
  });

  describe('catalog and deliveries', () => {
    it('downloads the whole catalog when the shelf count drifted', () => {
      expect(
        catalogSyncMode({
          since: new Date('2026-01-01T00:00:00.000Z'),
          localCount: 4,
          localStockSum: 10,
          sellableCount: 4,
          stockSum: 12,
          changedCount: 0,
        }),
      ).toBe('full');
    });

    it('lets only the newest received delivery replace the product cost', () => {
      const older = {
        id: 'a',
        deliveryDate: '2026-10-01T00:00:00.000Z',
        createdAt: '2026-10-01T01:00:00.000Z',
      };
      const newer = {
        id: 'b',
        deliveryDate: '2026-11-01T00:00:00.000Z',
        createdAt: '2026-11-01T01:00:00.000Z',
      };
      expect(isNewestCostUpdate(older, [newer])).toBe(false);
      expect(isNewestCostUpdate(newer, [older])).toBe(true);
    });

    it('drops an archived product from the register catalog', () => {
      expect(
        toCatalogProduct({
          id: 'gone',
          price: 10,
          deletedAt: '2026-11-01T00:00:00.000Z',
        }),
      ).toBeNull();
    });
  });
});
