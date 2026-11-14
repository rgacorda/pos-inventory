import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { OrderItemEntity } from '../../entities/order-item.entity';
import { ProductEntity } from '../../entities/product.entity';
import { PaymentEntity } from '../../entities/payment.entity';
import { UserEntity } from '../../entities/user.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { OrderStatus, PaymentStatus, UserRole } from '@pos/shared-types';
import { SALE_STATUSES, SALE_STATUS_SQL } from '../../common/sale-status';
import {
  businessCalendarDay,
  businessTimeZone,
  zonedParts,
  type BusinessCalendarDay,
} from '../financials/financials.range';

const SALE_LOCAL =
  '((COALESCE(order.completedAt, order.createdAt) AT TIME ZONE :storedAsTz) AT TIME ZONE :displayTz)';

const QTY_PATTERN = `'^-?[0-9]+(\\.[0-9]+)?$'`;

export interface DashboardStats {
  timezone: string;
  asOf: string;
  nowHour: number;
  today: {
    date: string;
    revenue: number;
    orders: number;
    averageOrderValue: number;
    unitsSold: number;
    unitsReturned: number;
    discount: number;
    cogs: number;
    grossProfit: number;
    margin: number;
  };
  yesterday: {
    date: string;
    revenue: number;
    orders: number;
  };
  hourly: Array<{ hour: number; revenue: number; orders: number }>;
  topProducts: Array<{
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    timeLabel: string;
    totalAmount: number;
    status: string;
    cashierName: string;
    itemCount: number;
  }>;
  payments: Array<{ method: string; amount: number; count: number }>;
  inventory: {
    totalProducts: number;
    activeProducts: number;
    outOfStock: number;
    lowStock: number;
    onHandValue: number;
    alerts: Array<{
      id: string;
      name: string;
      sku: string;
      stockQuantity: number;
      threshold: number;
    }>;
  };
  deliveries: {
    receivedCount: number;
    receivedCost: number;
    pendingCount: number;
  };
  overview: {
    netRevenue: number;
    totalOrders: number;
    totalProducts: number;
    activeProducts: number;
    teamSize: number;
  };
}

type DashboardUser = {
  role?: string;
  organizationId?: string;
  id?: string;
};

type Zones = { storedAsTz: string; displayTz: string };

function money(value: unknown): number {
  const amount = parseFloat(String(value ?? '0'));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function count(value: unknown): number {
  const amount = parseFloat(String(value ?? '0'));
  if (!Number.isFinite(amount)) return 0;
  return amount;
}

function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const raw = String(value).trim();
  return raw || fallback;
}

function isSuper(user: DashboardUser) {
  return user.role === UserRole.SUPER_ADMIN;
}

function isCashier(user: DashboardUser) {
  return user.role === UserRole.CASHIER;
}

function applyOrg(
  qb: SelectQueryBuilder<any>,
  user: DashboardUser,
  column: string,
) {
  if (!isSuper(user) && user.organizationId) {
    qb.andWhere(`${column} = :orgId`, { orgId: user.organizationId });
  }
  return qb;
}

function applyCashier(qb: SelectQueryBuilder<any>, user: DashboardUser) {
  if (isCashier(user) && user.id) {
    qb.andWhere('order.cashierId = :cashierId', { cashierId: user.id });
  }
  return qb;
}

function applySaleWindow(
  qb: SelectQueryBuilder<any>,
  bounds: BusinessCalendarDay,
  zones: Zones,
  expression = SALE_LOCAL,
) {
  qb.andWhere(`${expression} >= :rangeStart AND ${expression} < :rangeEnd`, {
    rangeStart: bounds.start,
    rangeEnd: bounds.end,
    storedAsTz: zones.storedAsTz,
    displayTz: zones.displayTz,
  });
  return qb;
}

function orgAndCashierSql(user: DashboardUser, params: unknown[]) {
  let sql = '';
  if (!isSuper(user) && user.organizationId) {
    params.push(user.organizationId);
    sql += ` AND o."organizationId" = $${params.length}`;
  }
  if (isCashier(user) && user.id) {
    params.push(user.id);
    sql += ` AND o."cashierId" = $${params.length}`;
  }
  return sql;
}

/**
 * Today's performance uses the shop calendar, not a UTC instant. Stored
 * timestamps have no zone, so the bounds stay naive wall-clock strings.
 */
export async function loadDashboardStats(
  deps: {
    orders: Repository<OrderEntity>;
    items: Repository<OrderItemEntity>;
    products: Repository<ProductEntity>;
    dataSource: DataSource;
    timezones: () => Zones;
  },
  user: DashboardUser,
): Promise<DashboardStats> {
  const zones = deps.timezones();
  const timezone = businessTimeZone();
  const now = new Date();
  const today = businessCalendarDay(now, 0, timezone);
  const yesterday = businessCalendarDay(now, -1, timezone);
  const nowHour = zonedParts(now, timezone).hour;

  const [
    dayRows,
    activity,
    hourlyRows,
    topRows,
    recentRows,
    paymentRows,
    inventoryRow,
    alertRows,
    receivedRow,
    pendingCount,
    orderCount,
    paymentTotals,
    teamSize,
  ] = await Promise.all([
    daySummary(deps.orders, user, yesterday, today, zones),
    lineActivity(deps.dataSource, user, today, zones),
    hourlySales(deps.orders, user, today, zones),
    topProducts(deps.items, user, today, zones),
    recentOrders(deps.orders, user, today, zones),
    paymentMix(deps.dataSource, user, today, zones),
    inventoryCounts(deps.products, user),
    stockAlerts(deps.products, user),
    receivedDeliveries(deps.dataSource, user, today, zones),
    pendingDeliveries(deps.dataSource, user),
    overviewOrders(deps.orders, user),
    overviewPayments(deps.dataSource, user),
    overviewTeam(deps.dataSource, user),
  ]);

  const todayRow = dayRows.find((row) => text(row.day) === today.date);
  const yesterdayRow = dayRows.find((row) => text(row.day) === yesterday.date);
  const revenue = money(todayRow?.revenue);
  const orders = count(todayRow?.orders);
  const cogs = money(activity.soldCost - activity.returnedCost);
  const grossProfit = money(revenue - cogs);

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const row = hourlyRows.find((entry) => count(entry.hour) === hour);
    return {
      hour,
      revenue: money(row?.revenue),
      orders: count(row?.orders),
    };
  });

  return {
    timezone,
    asOf: now.toISOString(),
    nowHour,
    today: {
      date: today.date,
      revenue,
      orders,
      averageOrderValue: orders > 0 ? money(revenue / orders) : 0,
      unitsSold: count(activity.unitsSold),
      unitsReturned: count(activity.unitsReturned),
      discount: money(todayRow?.discount),
      cogs,
      grossProfit,
      margin: revenue > 0 ? money((grossProfit / revenue) * 100) : 0,
    },
    yesterday: {
      date: yesterday.date,
      revenue: money(yesterdayRow?.revenue),
      orders: count(yesterdayRow?.orders),
    },
    hourly,
    topProducts: topRows.map((row) => ({
      name: text(row.name, 'Unnamed item'),
      sku: text(row.sku),
      quantity: count(row.quantity),
      revenue: money(row.revenue),
    })),
    recentOrders: recentRows.map((row) => ({
      id: text(row.id),
      orderNumber: text(row.orderNumber, 'Order'),
      timeLabel: text(row.timeLabel),
      totalAmount: money(row.totalAmount),
      status: text(row.status),
      cashierName: text(row.cashierName, 'Unknown'),
      itemCount: count(row.itemCount),
    })),
    payments: paymentRows.map((row) => ({
      method: text(row.method, 'OTHER'),
      amount: money(row.amount),
      count: count(row.paymentCount),
    })),
    inventory: {
      totalProducts: count(inventoryRow?.total),
      activeProducts: count(inventoryRow?.active),
      outOfStock: count(inventoryRow?.outOfStock),
      lowStock: count(inventoryRow?.lowStock),
      onHandValue: money(inventoryRow?.onHandValue),
      alerts: alertRows.map((row) => ({
        id: text(row.id),
        name: text(row.name, 'Unnamed product'),
        sku: text(row.sku),
        stockQuantity: count(row.stockQuantity),
        threshold: count(row.threshold),
      })),
    },
    deliveries: {
      receivedCount: count(receivedRow?.count),
      receivedCost: money(receivedRow?.cost),
      pendingCount,
    },
    overview: {
      netRevenue: money(paymentTotals.revenue - paymentTotals.refunds),
      totalOrders: orderCount,
      totalProducts: count(inventoryRow?.total),
      activeProducts: count(inventoryRow?.active),
      teamSize,
    },
  };
}

function daySummary(
  orders: Repository<OrderEntity>,
  user: DashboardUser,
  yesterday: BusinessCalendarDay,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const qb = orders
    .createQueryBuilder('order')
    .select(`TO_CHAR(${SALE_LOCAL}, 'YYYY-MM-DD')`, 'day')
    .addSelect('COALESCE(SUM(order.totalAmount), 0)', 'revenue')
    .addSelect('COUNT(order.id)', 'orders')
    .addSelect('COALESCE(SUM(order.discountAmount), 0)', 'discount')
    .where('order.status IN (:...saleStatuses)', { saleStatuses: SALE_STATUSES })
    .andWhere(`${SALE_LOCAL} >= :rangeStart AND ${SALE_LOCAL} < :rangeEnd`, {
      rangeStart: yesterday.start,
      rangeEnd: today.end,
      storedAsTz: zones.storedAsTz,
      displayTz: zones.displayTz,
    })
    .groupBy(`TO_CHAR(${SALE_LOCAL}, 'YYYY-MM-DD')`);
  applyOrg(qb, user, 'order.organizationId');
  applyCashier(qb, user);
  return qb.getRawMany();
}

function hourlySales(
  orders: Repository<OrderEntity>,
  user: DashboardUser,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const qb = orders
    .createQueryBuilder('order')
    .select(`EXTRACT(HOUR FROM ${SALE_LOCAL})`, 'hour')
    .addSelect('COALESCE(SUM(order.totalAmount), 0)', 'revenue')
    .addSelect('COUNT(order.id)', 'orders')
    .where('order.status IN (:...saleStatuses)', { saleStatuses: SALE_STATUSES });
  applySaleWindow(qb, today, zones);
  applyOrg(qb, user, 'order.organizationId');
  applyCashier(qb, user);
  qb.groupBy(`EXTRACT(HOUR FROM ${SALE_LOCAL})`);
  return qb.getRawMany();
}

function topProducts(
  items: Repository<OrderItemEntity>,
  user: DashboardUser,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const qb = items
    .createQueryBuilder('item')
    .innerJoin('item.order', 'order')
    .select('item.name', 'name')
    .addSelect('item.sku', 'sku')
    .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
    .addSelect('COALESCE(SUM(item.total), 0)', 'revenue')
    .where('order.status IN (:...saleStatuses)', { saleStatuses: SALE_STATUSES });
  applySaleWindow(qb, today, zones);
  applyOrg(qb, user, 'order.organizationId');
  applyCashier(qb, user);
  return qb
    .groupBy('item.name')
    .addGroupBy('item.sku')
    .orderBy('COALESCE(SUM(item.total), 0)', 'DESC')
    .limit(5)
    .getRawMany();
}

function recentOrders(
  orders: Repository<OrderEntity>,
  user: DashboardUser,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const qb = orders
    .createQueryBuilder('order')
    .leftJoin('order.items', 'items')
    .select('order.id', 'id')
    .addSelect('order.orderNumber', 'orderNumber')
    .addSelect(`TO_CHAR(${SALE_LOCAL}, 'FMHH12:MI AM')`, 'timeLabel')
    .addSelect('order.totalAmount', 'totalAmount')
    .addSelect('order.status', 'status')
    .addSelect(`COALESCE(NULLIF(order.cashierName, ''), 'Unknown')`, 'cashierName')
    .addSelect('COALESCE(SUM(items.quantity), 0)', 'itemCount')
    .where('order.status != :voidStatus', { voidStatus: OrderStatus.VOID });
  applySaleWindow(qb, today, zones);
  applyOrg(qb, user, 'order.organizationId');
  applyCashier(qb, user);
  return qb
    .groupBy('order.id')
    .addGroupBy('order.orderNumber')
    .addGroupBy('order.completedAt')
    .addGroupBy('order.createdAt')
    .addGroupBy('order.totalAmount')
    .addGroupBy('order.status')
    .addGroupBy('order.cashierName')
    .orderBy(SALE_LOCAL, 'DESC')
    .limit(8)
    .getRawMany();
}

function paymentMix(
  dataSource: DataSource,
  user: DashboardUser,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const qb = dataSource
    .getRepository(PaymentEntity)
    .createQueryBuilder('payment')
    .innerJoin('payment.order', 'order')
    .select('payment.method', 'method')
    .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
    .addSelect('COUNT(payment.id)', 'paymentCount')
    .where('payment.status = :payStatus', { payStatus: PaymentStatus.COMPLETED })
    .andWhere('payment.amount > 0')
    .andWhere('order.status != :voidStatus', { voidStatus: OrderStatus.VOID });
  applySaleWindow(qb, today, zones);
  applyOrg(qb, user, 'payment.organizationId');
  applyCashier(qb, user);
  return qb
    .groupBy('payment.method')
    .orderBy('COALESCE(SUM(payment.amount), 0)', 'DESC')
    .getRawMany();
}

async function lineActivity(
  dataSource: DataSource,
  user: DashboardUser,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const params: unknown[] = [
    zones.storedAsTz,
    zones.displayTz,
    today.start,
    today.end,
  ];
  const scope = orgAndCashierSql(user, params);
  const saleWindow = `
    ((COALESCE(o."completedAt", o."createdAt") AT TIME ZONE $1) AT TIME ZONE $2) >= $3::timestamp
    AND ((COALESCE(o."completedAt", o."createdAt") AT TIME ZONE $1) AT TIME ZONE $2) < $4::timestamp
  `;
  const soldSql = `
    SELECT COALESCE(SUM(i."quantity"), 0) AS units,
           COALESCE(SUM(
             CASE
               WHEN i."productId" IS NULL OR i."productId" = '' OR i."productId" LIKE 'manual-%' THEN 0
               ELSE i."quantity" * CASE
                 WHEN i."unitCost" IS NOT NULL THEN i."unitCost"
                 ELSE COALESCE(p."cost", 0)
               END
             END
           ), 0) AS cost
    FROM "order_items" i
    INNER JOIN "orders" o ON o."id" = i."orderId"
    LEFT JOIN "products" p
      ON p."id"::text = i."productId"
     AND p."organizationId" = o."organizationId"
    WHERE o."status"::text IN (${SALE_STATUS_SQL})
      AND ${saleWindow}
      ${scope}
  `;
  const returnedSql = `
    SELECT COALESCE(SUM(
             CASE
               WHEN elem->>'quantity' ~ ${QTY_PATTERN}
               THEN (elem->>'quantity')::numeric
               ELSE 0
             END
           ), 0) AS units,
           COALESCE(SUM(
             CASE
               WHEN elem->>'quantity' ~ ${QTY_PATTERN}
               THEN (elem->>'quantity')::numeric
               ELSE 0
             END
             * COALESCE(
                 CASE
                   WHEN elem->>'unitCost' ~ ${QTY_PATTERN}
                   THEN (elem->>'unitCost')::numeric
                 END,
                 p."cost",
                 0
               )
           ), 0) AS cost
    FROM "orders" o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o."returnedItems", '[]'::jsonb)) AS elem
    LEFT JOIN "products" p
      ON p."id"::text = elem->>'productId'
     AND p."organizationId" = o."organizationId"
    WHERE o."status"::text <> 'VOID'
      AND ((o."exchangedAt" AT TIME ZONE $1) AT TIME ZONE $2) >= $3::timestamp
      AND ((o."exchangedAt" AT TIME ZONE $1) AT TIME ZONE $2) < $4::timestamp
      AND COALESCE(elem->>'productId', '') <> ''
      AND elem->>'productId' NOT LIKE 'manual-%'
      ${scope}
  `;
  const [soldRows, returnedRows] = await Promise.all([
    dataSource.query(soldSql, params),
    dataSource.query(returnedSql, params),
  ]);
  const sold = soldRows?.[0] ?? {};
  const returned = returnedRows?.[0] ?? {};
  return {
    unitsSold: count(sold.units),
    soldCost: money(sold.cost),
    unitsReturned: count(returned.units),
    returnedCost: money(returned.cost),
  };
}

function inventoryCounts(products: Repository<ProductEntity>, user: DashboardUser) {
  const tracked =
    'product.infiniteStock = false AND product.status = :activeStatus';
  const qb = products
    .createQueryBuilder('product')
    .select('COUNT(product.id)', 'total')
    .addSelect(
      `SUM(CASE WHEN product.status = :activeStatus THEN 1 ELSE 0 END)`,
      'active',
    )
    .addSelect(
      `SUM(CASE WHEN ${tracked} AND product.stockQuantity <= 0 THEN 1 ELSE 0 END)`,
      'outOfStock',
    )
    .addSelect(
      `SUM(CASE WHEN ${tracked} AND product.stockQuantity > 0 AND product.stockQuantity <= COALESCE(product.lowStockThreshold, 10) THEN 1 ELSE 0 END)`,
      'lowStock',
    )
    .addSelect(
      `COALESCE(SUM(CASE WHEN ${tracked} AND product.stockQuantity > 0 THEN product.stockQuantity * COALESCE(product.cost, 0) ELSE 0 END), 0)`,
      'onHandValue',
    )
    .where('product.deletedAt IS NULL')
    .setParameter('activeStatus', 'ACTIVE');
  applyOrg(qb, user, 'product.organizationId');
  return qb.getRawOne();
}

function stockAlerts(products: Repository<ProductEntity>, user: DashboardUser) {
  const qb = products
    .createQueryBuilder('product')
    .select('product.id', 'id')
    .addSelect('product.name', 'name')
    .addSelect('product.sku', 'sku')
    .addSelect('product.stockQuantity', 'stockQuantity')
    .addSelect('COALESCE(product.lowStockThreshold, 10)', 'threshold')
    .where('product.deletedAt IS NULL')
    .andWhere('product.status = :activeStatus', { activeStatus: 'ACTIVE' })
    .andWhere('product.infiniteStock = false')
    .andWhere(
      'product.stockQuantity <= COALESCE(product.lowStockThreshold, 10)',
    );
  applyOrg(qb, user, 'product.organizationId');
  return qb
    .orderBy('product.stockQuantity', 'ASC')
    .addOrderBy('product.name', 'ASC')
    .limit(6)
    .getRawMany();
}

function receivedDeliveries(
  dataSource: DataSource,
  user: DashboardUser,
  today: BusinessCalendarDay,
  zones: Zones,
) {
  const local =
    '((delivery.deliveryDate AT TIME ZONE :storedAsTz) AT TIME ZONE :displayTz)';
  const qb = dataSource
    .getRepository(InventoryDelivery)
    .createQueryBuilder('delivery')
    .select('COUNT(delivery.id)', 'count')
    .addSelect('COALESCE(SUM(delivery.totalCost), 0)', 'cost')
    .where('delivery.deletedAt IS NULL')
    .andWhere('delivery.status = :status', { status: 'RECEIVED' });
  applySaleWindow(qb, today, zones, local);
  applyOrg(qb, user, 'delivery.organizationId');
  return qb.getRawOne();
}

async function pendingDeliveries(dataSource: DataSource, user: DashboardUser) {
  const qb = dataSource
    .getRepository(InventoryDelivery)
    .createQueryBuilder('delivery')
    .where('delivery.deletedAt IS NULL')
    .andWhere('delivery.status = :status', { status: 'PENDING' });
  applyOrg(qb, user, 'delivery.organizationId');
  return qb.getCount();
}

async function overviewOrders(orders: Repository<OrderEntity>, user: DashboardUser) {
  const qb = orders
    .createQueryBuilder('order')
    .where('order.status IN (:...saleStatuses)', { saleStatuses: SALE_STATUSES });
  applyOrg(qb, user, 'order.organizationId');
  return qb.getCount();
}

async function overviewPayments(dataSource: DataSource, user: DashboardUser) {
  const qb = dataSource
    .getRepository(PaymentEntity)
    .createQueryBuilder('payment')
    .innerJoin('payment.order', 'order')
    .select(
      `COALESCE(SUM(CASE WHEN payment.status = :completed AND payment.amount > 0 THEN payment.amount ELSE 0 END), 0)`,
      'revenue',
    )
    .addSelect(
      `COALESCE(SUM(CASE WHEN payment.status = :refunded THEN ABS(payment.amount) ELSE 0 END), 0)`,
      'refunds',
    )
    .where('order.status != :voidStatus', { voidStatus: OrderStatus.VOID })
    .setParameter('completed', PaymentStatus.COMPLETED)
    .setParameter('refunded', PaymentStatus.REFUNDED);
  applyOrg(qb, user, 'payment.organizationId');
  const row = await qb.getRawOne();
  return {
    revenue: money(row?.revenue),
    refunds: money(row?.refunds),
  };
}

async function overviewTeam(dataSource: DataSource, user: DashboardUser) {
  const qb = dataSource
    .getRepository(UserEntity)
    .createQueryBuilder('user')
    .where('user.isActive = true');
  applyOrg(qb, user, 'user.organizationId');
  return qb.getCount();
}
