import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { Expense } from '../../entities/expense.entity';
import { ProductEntity } from '../../entities/product.entity';
import { OrderStatus } from '@pos/shared-types';
import {
  assembleTrend,
  businessTimeZone,
  currentBusinessMonthRange,
  parseRange,
} from './financials.range';

/**
 * Exchange checkouts are stored as EXCHANGE. Their totalAmount is what the
 * customer still paid after the return credit, so they belong in revenue
 * with completed and synced sales. Sales reports already count them.
 */
const REVENUE_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.SYNCED,
  OrderStatus.EXCHANGE,
];

export interface DeliveredGoods {
  total: number;
  goodsValue: number;
  discount: number;
  returnCredit: number;
  deliveriesCount: number;
}

export interface InventoryValue {
  /** On-hand cost plus negative-stock cost (a negative number). */
  netValue: number;
  onHandValue: number;
  /** Sum of quantity × cost for products below zero. Zero or negative. */
  negativeValue: number;
  onHandCount: number;
  negativeCount: number;
  /** Sum of quantities below zero. Zero or negative. */
  negativeUnits: number;
  /** Tracked products with quantity and no unit cost. They add nothing. */
  missingCostCount: number;
  /** Non-zero stock still sitting on archived products, excluded above. */
  archivedValue: number;
  archivedCount: number;
  /** Unlimited-stock products have no quantity to value. */
  unlimitedCount: number;
}

@Injectable()
export class FinancialsService {
  private readonly logger = new Logger(FinancialsService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  async calculateProfitLoss(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    const period = parseRange(startDate, endDate);
    const month = currentBusinessMonthRange();

    this.logger.log(
      `Calculating P&L for org ${organizationId} from ${period.startDate} to ${period.endDate}`,
    );

    const [
      revenueResult,
      deliveryResult,
      expenseRows,
      inventoryRow,
      monthDeliveryResult,
      revenueDays,
      purchaseDays,
      cogsActivity,
    ] = await Promise.all([
      this.orderRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .addSelect('COUNT(order.id)', 'count')
        .where('order.organizationId = :organizationId', { organizationId })
        .andWhere('order.status IN (:...statuses)', {
          statuses: REVENUE_STATUSES,
        })
        .andWhere(
          'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
          period,
        )
        .getRawOne(),

      this.deliveredGoodsQuery(
        organizationId,
        period.startDate,
        period.endDate,
      ),

      this.expenseRepository
        .createQueryBuilder('expense')
        .select('expense.type', 'type')
        .addSelect('SUM(expense.amount)', 'total')
        .where('expense.organizationId = :organizationId', { organizationId })
        .andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', period)
        .groupBy('expense.type')
        .getRawMany(),

      this.inventoryValueQuery(organizationId),

      this.deliveredGoodsQuery(organizationId, month.startDate, month.endDate),

      this.dailyRevenue(organizationId, period.startDate, period.endDate),

      this.dailyPurchases(organizationId, period.startDate, period.endDate),

      this.cogsActivity(organizationId, period.startDate, period.endDate),
    ]);

    const revenue = this.money(revenueResult?.total);
    const totalOrders = this.count(revenueResult?.count);
    const deliveredGoods = this.readDeliveredGoods(deliveryResult);
    const currentMonthDeliveries = this.readDeliveredGoods(monthDeliveryResult);

    const expensesByType: Record<string, number> = {};
    let operatingExpenses = 0;
    for (const row of expenseRows) {
      const amount = this.money(row.total);
      expensesByType[row.type] = amount;
      operatingExpenses = this.money(operatingExpenses + amount);
    }

    const cogs = this.readCostOfGoodsSold(cogsActivity);
    const grossProfit = this.money(revenue - cogs.total);
    const netProfit = this.money(grossProfit - operatingExpenses);
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const trend = assembleTrend(
      new Date(period.startDate),
      new Date(period.endDate),
      this.readDayMap(revenueDays),
      this.readDayMap(purchaseDays),
      cogs.byDay,
    );

    return {
      period,
      revenue: {
        total: revenue,
        ordersCount: totalOrders,
      },
      cogs: {
        total: cogs.total,
        soldCost: cogs.soldCost,
        returnedCost: cogs.returnedCost,
        unitsSold: cogs.unitsSold,
        unitsReturned: cogs.unitsReturned,
        missingCostCount: cogs.missingCostCount,
      },
      deliveredGoods,
      currentMonthDeliveries: {
        period: month,
        ...currentMonthDeliveries,
      },
      inventory: this.readInventoryValue(inventoryRow),
      operatingExpenses: {
        total: operatingExpenses,
        breakdown: expensesByType,
      },
      grossProfit,
      netProfit,
      metrics: {
        grossMargin: Number(grossMargin.toFixed(2)),
        netMargin: Number(netMargin.toFixed(2)),
      },
      trend,
    };
  }

  async getFinancialSummary(organizationId: string) {
    const month = currentBusinessMonthRange();
    return this.calculateProfitLoss(
      organizationId,
      month.startDate,
      month.endDate,
    );
  }

  /**
   * Daily revenue in the shop timezone. Exchange checkouts are included,
   * matching the period total.
   */
  private dailyRevenue(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    const bucket = this.businessDayBucket(
      'COALESCE(order.completedAt, order.createdAt)',
    );
    return this.orderRepository
      .createQueryBuilder('order')
      .select(bucket, 'bucket')
      .addSelect('SUM(order.totalAmount)', 'total')
      .where('order.organizationId = :organizationId', { organizationId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: REVENUE_STATUSES,
      })
      .andWhere(
        'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      )
      .groupBy(bucket)
      .setParameter('storedAsTz', this.storedTimeZone())
      .setParameter('displayTz', businessTimeZone())
      .getRawMany();
  }

  /**
   * Cost of goods sold is units sold times each product's current unit cost.
   * Exchanges reduce it by the returned units, dated on the day they were
   * exchanged, so a returned item is not still treated as sold.
   * Manual lines have no product cost and are left out.
   */
  private async cogsActivity(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    const params = [
      this.storedTimeZone(),
      businessTimeZone(),
      organizationId,
      startDate,
      endDate,
    ];
    const soldSql = `
      SELECT TO_CHAR(
               (COALESCE(o."completedAt", o."createdAt") AT TIME ZONE $1) AT TIME ZONE $2,
               'YYYY-MM-DD'
             ) AS bucket,
             COALESCE(SUM(i."quantity" * COALESCE(p."cost", 0)), 0) AS total,
             COALESCE(SUM(i."quantity"), 0) AS units,
             COALESCE(SUM(
               CASE
                 WHEN p."id" IS NULL OR p."cost" IS NULL OR p."cost" = 0 THEN 1
                 ELSE 0
               END
             ), 0) AS missing
      FROM "order_items" i
      INNER JOIN "orders" o ON o."id" = i."orderId"
      LEFT JOIN "products" p
        ON p."id"::text = i."productId"
       AND p."organizationId" = o."organizationId"
      WHERE o."organizationId" = $3
        AND o."status"::text IN ('COMPLETED', 'SYNCED', 'EXCHANGE')
        AND COALESCE(o."completedAt", o."createdAt") BETWEEN $4 AND $5
        AND i."productId" IS NOT NULL
        AND i."productId" <> ''
        AND i."productId" NOT LIKE 'manual-%'
      GROUP BY 1
    `;
    const returnedSql = `
      SELECT TO_CHAR(
               (o."exchangedAt" AT TIME ZONE $1) AT TIME ZONE $2,
               'YYYY-MM-DD'
             ) AS bucket,
             COALESCE(SUM(
               CASE
                 WHEN elem->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$'
                 THEN (elem->>'quantity')::numeric
                 ELSE 0
               END * COALESCE(p."cost", 0)
             ), 0) AS total,
             COALESCE(SUM(
               CASE
                 WHEN elem->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$'
                 THEN (elem->>'quantity')::numeric
                 ELSE 0
               END
             ), 0) AS units,
             0 AS missing
      FROM "orders" o
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(o."returnedItems", '[]'::jsonb)
      ) AS elem
      LEFT JOIN "products" p
        ON p."id"::text = elem->>'productId'
       AND p."organizationId" = o."organizationId"
      WHERE o."organizationId" = $3
        AND o."exchangedAt" BETWEEN $4 AND $5
        AND COALESCE(elem->>'productId', '') <> ''
        AND elem->>'productId' NOT LIKE 'manual-%'
      GROUP BY 1
    `;
    const [soldRows, returnedRows] = await Promise.all([
      this.orderRepository.query(soldSql, params),
      this.orderRepository.query(returnedSql, params),
    ]);
    return {
      soldRows: soldRows as Array<Record<string, unknown>>,
      returnedRows: returnedRows as Array<Record<string, unknown>>,
    };
  }

  private readCostOfGoodsSold(activity: {
    soldRows: Array<Record<string, unknown>>;
    returnedRows: Array<Record<string, unknown>>;
  }) {
    const sold = this.readCogsRows(activity.soldRows);
    const returned = this.readCogsRows(activity.returnedRows);
    const days = new Set([
      ...Object.keys(sold.byDay),
      ...Object.keys(returned.byDay),
    ]);
    const byDay: Record<string, number> = {};
    for (const day of days) {
      byDay[day] = this.money((sold.byDay[day] ?? 0) - (returned.byDay[day] ?? 0));
    }
    return {
      total: this.money(sold.total - returned.total),
      soldCost: sold.total,
      returnedCost: returned.total,
      unitsSold: sold.units,
      unitsReturned: returned.units,
      missingCostCount: sold.missingCostCount,
      byDay,
    };
  }

  private readCogsRows(rows: Array<Record<string, unknown>>) {
    const byDay: Record<string, number> = {};
    let total = 0;
    let units = 0;
    let missingCostCount = 0;
    for (const row of rows) {
      const amount = this.money(row?.total);
      const bucket = String(row?.bucket ?? '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
        byDay[bucket] = this.money((byDay[bucket] ?? 0) + amount);
      }
      total = this.money(total + amount);
      units += this.count(row?.units);
      missingCostCount += this.count(row?.missing);
    }
    return { byDay, total, units, missingCostCount };
  }

  /** Daily cost of received, non-archived deliveries in the shop timezone. */
  private dailyPurchases(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    const bucket = this.businessDayBucket('delivery.deliveryDate');
    return this.deliveryRepository
      .createQueryBuilder('delivery')
      .select(bucket, 'bucket')
      .addSelect('SUM(COALESCE(delivery.totalCost, 0))', 'total')
      .where('delivery.organizationId = :organizationId', { organizationId })
      .andWhere('delivery.deletedAt IS NULL')
      .andWhere('delivery.status = :status', { status: 'RECEIVED' })
      .andWhere('delivery.deliveryDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy(bucket)
      .setParameter('storedAsTz', this.storedTimeZone())
      .setParameter('displayTz', businessTimeZone())
      .getRawMany();
  }

  /**
   * Timestamps are stored without a zone, in the server's local clock.
   * Shift them into the shop timezone before naming the calendar day.
   */
  private businessDayBucket(expression: string): string {
    return `TO_CHAR((${expression} AT TIME ZONE :storedAsTz) AT TIME ZONE :displayTz, 'YYYY-MM-DD')`;
  }

  private storedTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  private readDayMap(rows: Array<Record<string, unknown>>): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      const bucket = String(row?.bucket ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bucket)) continue;
      totals[bucket] = this.money((totals[bucket] ?? 0) + this.money(row?.total));
    }
    return totals;
  }

  /**
   * Received deliveries only. Archived rows stay in the table for history
   * but no longer represent goods we accepted, so they are excluded.
   * totalCost is what was paid after discounts and return credits.
   */
  private deliveredGoodsQuery(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    return this.deliveryRepository
      .createQueryBuilder('delivery')
      .select('SUM(COALESCE(delivery.totalCost, 0))', 'total')
      .addSelect('COUNT(delivery.id)', 'count')
      .addSelect('SUM(COALESCE(delivery.discountAmount, 0))', 'discount')
      .addSelect(
        'SUM(COALESCE(delivery.returnCreditAmount, 0))',
        'returnCredit',
      )
      .where('delivery.organizationId = :organizationId', { organizationId })
      .andWhere('delivery.deletedAt IS NULL')
      .andWhere('delivery.status = :status', { status: 'RECEIVED' })
      .andWhere('delivery.deliveryDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();
  }

  /**
   * Current cost × quantity, including quantities below zero. A negative
   * quantity lowers the total by the current unit cost of those units.
   * Unlimited products have no quantity. Archived products are reported
   * separately so active stock is not mixed with hidden rows.
   */
  private inventoryValueQuery(organizationId: string) {
    const tracked =
      'product.deletedAt IS NULL AND product.infiniteStock = false';
    const archived =
      'product.deletedAt IS NOT NULL AND product.infiniteStock = false AND product.stockQuantity <> 0';

    return this.productRepository
      .createQueryBuilder('product')
      .select(
        `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity > 0 THEN product.stockQuantity * COALESCE(product.cost, 0) ELSE 0 END), 0)`,
        'onHandValue',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity < 0 THEN product.stockQuantity * COALESCE(product.cost, 0) ELSE 0 END), 0)`,
        'negativeValue',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity > 0 THEN 1 ELSE 0 END), 0)`,
        'onHandCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity < 0 THEN 1 ELSE 0 END), 0)`,
        'negativeCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity < 0 THEN product.stockQuantity ELSE 0 END), 0)`,
        'negativeUnits',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity <> 0 AND (product.cost IS NULL OR product.cost = 0) THEN 1 ELSE 0 END), 0)`,
        'missingCostCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${archived} THEN product.stockQuantity * COALESCE(product.cost, 0) ELSE 0 END), 0)`,
        'archivedValue',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${archived} THEN 1 ELSE 0 END), 0)`,
        'archivedCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN product.deletedAt IS NULL AND product.infiniteStock = true THEN 1 ELSE 0 END), 0)`,
        'unlimitedCount',
      )
      .where('product.organizationId = :organizationId', { organizationId })
      .getRawOne();
  }

  private readDeliveredGoods(row: Record<string, unknown> | undefined): DeliveredGoods {
    const total = this.money(row?.total);
    const discount = this.money(row?.discount);
    const returnCredit = this.money(row?.returnCredit);
    return {
      total,
      discount,
      returnCredit,
      goodsValue: this.money(total + discount + returnCredit),
      deliveriesCount: this.count(row?.count),
    };
  }

  private readInventoryValue(row: Record<string, unknown> | undefined): InventoryValue {
    const onHandValue = this.money(row?.onHandValue);
    const negativeValue = this.money(row?.negativeValue);
    return {
      netValue: this.money(onHandValue + negativeValue),
      onHandValue,
      negativeValue,
      onHandCount: this.count(row?.onHandCount),
      negativeCount: this.count(row?.negativeCount),
      negativeUnits: this.count(row?.negativeUnits),
      missingCostCount: this.count(row?.missingCostCount),
      archivedValue: this.money(row?.archivedValue),
      archivedCount: this.count(row?.archivedCount),
      unlimitedCount: this.count(row?.unlimitedCount),
    };
  }

  private money(value: unknown): number {
    const amount = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100) / 100;
  }

  private count(value: unknown): number {
    const amount = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(amount)) return 0;
    return Math.trunc(amount);
  }
}
