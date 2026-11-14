import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, Repository, QueryFailedError, DataSource, EntityManager } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { UserEntity } from '../../entities/user.entity';
import { OrderItemEntity } from '../../entities/order-item.entity';
import { ProductEntity } from '../../entities/product.entity';
import { PaymentEntity } from '../../entities/payment.entity';
import { CustomerEntity } from '../../entities/customer.entity';
import {
  CustomerPointTransactionEntity,
  PointTransactionType,
} from '../../entities/customer-point-transaction.entity';
import { TerminalEntity } from '../../entities/terminal.entity';
import { CreateOrderDto, CreateOrderItemDto, UpdateOrderDto, ExchangeOrderDto } from './dto';
import { UserRole, OrderStatus, PaymentStatus } from '@pos/shared-types';
import {
  adjustTrackedStock,
  quantitiesStillSold,
} from '../../common/stock-quantity';
import {
  loadProductUnitCosts,
  recordedUnitCost,
  stampReturnUnitCosts,
  unitCostByProduct,
} from '../../common/sale-cost';
import { SALE_STATUSES, SALE_STATUS_SQL } from '../../common/sale-status';
import { loadDashboardStats } from './dashboard-stats';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private ordersRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private orderItemsRepository: Repository<OrderItemEntity>,
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
    private dataSource: DataSource,
  ) {}

  /**
   * Order timestamps are `timestamp without time zone`, written in the Node
   * process timezone (TypeORM default `timezone: 'local'`). Local machines
   * typically persist Asia/Manila wall-clock hours; a UTC production server
   * persists UTC hours. Reports must convert from that source zone to the
   * business timezone before grouping by hour or calendar date.
   */
  private getReportTimezones(): { storedAsTz: string; displayTz: string } {
    return {
      storedAsTz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      displayTz: process.env.APP_TIMEZONE || 'Asia/Manila',
    };
  }

  async create(createOrderDto: CreateOrderDto, requestingUser: any) {
    const { orderNumber, posLocalId, organizationId, items } = createOrderDto;

    // Set organization from requesting user if not super admin
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      createOrderDto.organizationId = requestingUser.organizationId;
    } else if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Check if order number already exists
    const existingByOrderNumber = await this.ordersRepository.findOne({
      where: { orderNumber },
    });

    if (existingByOrderNumber) {
      throw new ConflictException('Order number already exists');
    }

    // Check if posLocalId already exists (for offline sync)
    const existingByPosLocalId = await this.ordersRepository.findOne({
      where: { posLocalId },
    });

    if (existingByPosLocalId) {
      throw new ConflictException('POS local ID already exists');
    }

    // Validate items
    if (!items || items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    // Keep the cashier name on the order so it remains after the account is deleted.
    let cashierName: string | undefined;
    if (createOrderDto.cashierId) {
      const cashier = await this.dataSource.getRepository(UserEntity).findOne({
        where: { id: createOrderDto.cashierId },
        select: { id: true, name: true },
      });
      cashierName = cashier?.name;
    }

    // Create order
    const order = this.ordersRepository.create({
      ...createOrderDto,
      cashierName,
      items: undefined, // Remove items from spread, we'll add them separately
    });

    const savedOrder = await this.ordersRepository.save(order);

    const unitCosts = await loadProductUnitCosts(
      this.productsRepository.manager,
      savedOrder.organizationId,
      items.map((item) => item.productId),
    );

    // Create order items
    const orderItems = items.map((item) => {
      const line = item as CreateOrderItemDto & {
        unitPrice?: number;
        unitCost?: unknown;
        discountAmount?: number;
      };
      const quantity = Math.max(0, Math.round(Number(line.quantity) || 0));
      const unitPrice = roundMoney(Number(line.unitPrice ?? line.price) || 0);
      const discountAmount = roundMoney(
        Number(line.discountAmount ?? line.discount) || 0,
      );
      const taxRate = Number(line.taxRate) || 0;
      const subtotal = roundMoney(quantity * unitPrice);
      const total = roundMoney(subtotal - discountAmount + subtotal * taxRate);
      return this.orderItemsRepository.create({
        orderId: savedOrder.id,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        quantity,
        unitPrice,
        unitCost: recordedUnitCost(line.productId, line.unitCost, unitCosts),
        taxRate,
        discountAmount,
        subtotal,
        total,
      });
    });

    await this.orderItemsRepository.save(orderItems);

    // Return order with items
    return this.findOne(savedOrder.id, requestingUser);
  }

  async findAll(
    requestingUser: any,
    filters?: {
      status?: OrderStatus;
      terminalId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
      sort?: 'asc' | 'desc';
    },
  ) {
    // Inventory list sends page/limit so 10k+ orders are not joined and
    // serialized in one response (that path exceeds the 30s client timeout).
    if (
      filters?.page != null ||
      filters?.limit != null ||
      Boolean(filters?.search?.trim())
    ) {
      return this.findPage(requestingUser, filters);
    }

    const query = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.terminal', 'terminal')
      .leftJoinAndSelect('order.cashier', 'cashier')
      .leftJoinAndSelect('order.payments', 'payments')
      .orderBy('COALESCE(order.completedAt, order.createdAt)', 'DESC');

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('order.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    // Apply additional filters
    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.terminalId) {
      query.andWhere('order.terminalId = :terminalId', {
        terminalId: filters.terminalId,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere(
        'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    // Cashiers can only see their own orders
    if (requestingUser.role === UserRole.CASHIER) {
      query.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    return query.getMany();
  }

  /**
   * One page of orders for the inventory list. Joins only terminal and cashier
   * names, then counts items and payment methods for those rows. Loading every
   * order with items and payments multiplies into tens of thousands of rows.
   */
  private async findPage(
    requestingUser: any,
    filters?: {
      status?: OrderStatus;
      terminalId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
      sort?: 'asc' | 'desc';
    },
  ) {
    const page =
      Number.isFinite(filters?.page) && (filters?.page as number) > 0
        ? Math.floor(filters!.page as number)
        : 1;
    const limit =
      Number.isFinite(filters?.limit) && (filters?.limit as number) > 0
        ? Math.min(100, Math.floor(filters!.limit as number))
        : 20;
    const sortDir = filters?.sort === 'asc' ? 'ASC' : 'DESC';

    const filtered = this.ordersRepository.createQueryBuilder('order');
    this.applyOrderListFilters(filtered, requestingUser, filters);

    const total = await filtered.clone().getCount();

    const idRows = await filtered
      .clone()
      .select('order.id', 'id')
      .orderBy('COALESCE(order.completedAt, order.createdAt)', sortDir)
      .addOrderBy('order.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const ids = idRows
      .map(
        (row) =>
          this.rawField(row, 'id') ?? this.rawField(row, 'order_id'),
      )
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (ids.length === 0) {
      return { data: [], total, page, limit };
    }

    const orders = await this.ordersRepository.find({
      where: { id: In(ids) },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        cashierName: true,
        status: true,
        totalAmount: true,
        completedAt: true,
        createdAt: true,
        terminalId: true,
        cashierId: true,
      },
    });

    const terminalIds = [
      ...new Set(orders.map((order) => order.terminalId).filter(Boolean)),
    ] as string[];
    const cashierIds = [
      ...new Set(orders.map((order) => order.cashierId).filter(Boolean)),
    ] as string[];

    const [terminals, cashiers] = await Promise.all([
      terminalIds.length
        ? this.dataSource.getRepository(TerminalEntity).find({
            where: { id: In(terminalIds) },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      cashierIds.length
        ? this.dataSource.getRepository(UserEntity).find({
            where: { id: In(cashierIds) },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const byId = new Map(orders.map((order) => [order.id, order]));
    const terminalNameById = new Map(terminals.map((terminal) => [terminal.id, terminal.name]));
    const cashierNameById = new Map(cashiers.map((cashier) => [cashier.id, cashier.name]));

    const [itemCounts, paymentsByOrder] = await Promise.all([
      this.orderItemsRepository
        .createQueryBuilder('item')
        .select('item.orderId', 'orderId')
        .addSelect('COUNT(item.id)', 'count')
        .where('item.orderId IN (:...ids)', { ids })
        .groupBy('item.orderId')
        .getRawMany(),
      this.dataSource
        .getRepository(PaymentEntity)
        .createQueryBuilder('payment')
        .select('payment.orderId', 'orderId')
        .addSelect('payment.method', 'method')
        .where('payment.orderId IN (:...ids)', { ids })
        .getRawMany(),
    ]);

    const countById = new Map<string, number>();
    for (const row of itemCounts) {
      const orderId =
        this.rawField(row, 'orderId') ?? this.rawField(row, 'item_orderId');
      if (typeof orderId !== 'string') continue;
      countById.set(orderId, parseInt(String(this.rawField(row, 'count') ?? '0'), 10));
    }

    const methodsById = new Map<string, string[]>();
    for (const row of paymentsByOrder) {
      const orderId =
        this.rawField(row, 'orderId') ?? this.rawField(row, 'payment_orderId');
      const method = this.rawField(row, 'method');
      if (typeof orderId !== 'string' || typeof method !== 'string') continue;
      const methods = methodsById.get(orderId) ?? [];
      if (!methods.includes(method)) methods.push(method);
      methodsById.set(orderId, methods);
    }

    const data = ids
      .map((id) => {
        const order = byId.get(id);
        if (!order) return null;
        const terminalName = order.terminalId
          ? terminalNameById.get(order.terminalId)
          : undefined;
        const cashierName = order.cashierId
          ? cashierNameById.get(order.cashierId)
          : undefined;
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          cashierName: order.cashierName,
          status: order.status,
          totalAmount: order.totalAmount,
          completedAt: order.completedAt,
          createdAt: order.createdAt,
          terminal: terminalName ? { name: terminalName } : null,
          cashier: cashierName ? { name: cashierName } : null,
          itemCount: countById.get(id) ?? 0,
          payments: (methodsById.get(id) ?? []).map((method) => ({ method })),
        };
      })
      .filter((order) => order !== null);

    return { data, total, page, limit };
  }

  private applyOrderListFilters(
    query: ReturnType<Repository<OrderEntity>['createQueryBuilder']>,
    requestingUser: any,
    filters?: {
      status?: OrderStatus;
      terminalId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('order.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    } else {
      query.where('1=1');
    }

    const statusValues = new Set<string>(Object.values(OrderStatus));
    if (filters?.status && statusValues.has(filters.status)) {
      query.andWhere('order.status = :status', { status: filters.status });
    } else if (filters?.status) {
      query.andWhere('1 = 0');
    }

    if (filters?.terminalId) {
      query.andWhere('order.terminalId = :terminalId', {
        terminalId: filters.terminalId,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere(
        'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    if (requestingUser.role === UserRole.CASHIER) {
      query.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    const search = filters?.search?.trim().slice(0, 100);
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      query.andWhere(
        `(order.orderNumber ILIKE :search ESCAPE '\\' OR order.customerName ILIKE :search ESCAPE '\\' OR COALESCE(order.cashierName, '') ILIKE :search ESCAPE '\\' OR CAST(order.id AS text) ILIKE :search ESCAPE '\\' OR EXISTS (SELECT 1 FROM terminals terminal_match WHERE terminal_match.id = order.terminalId AND terminal_match.name ILIKE :search ESCAPE '\\') OR EXISTS (SELECT 1 FROM users user_match WHERE user_match.id = order.cashierId AND user_match.name ILIKE :search ESCAPE '\\'))`,
        { search: pattern },
      );
    }
  }

  private rawField(row: Record<string, unknown>, key: string) {
    if (row[key] != null) return row[key];
    const lower = key.toLowerCase();
    const match = Object.keys(row).find((candidate) => candidate.toLowerCase() === lower);
    return match ? row[match] : undefined;
  }

  async getDashboardStats(requestingUser: any) {
    return loadDashboardStats(
      {
        orders: this.ordersRepository,
        items: this.orderItemsRepository,
        products: this.productsRepository,
        dataSource: this.dataSource,
        timezones: () => this.getReportTimezones(),
      },
      requestingUser,
    );
  }

  async getReportAnalytics(
    requestingUser: any,
    startDate: string,
    endDate: string,
  ) {
    const isSuperAdmin = requestingUser.role === UserRole.SUPER_ADMIN;
    const isCashier = requestingUser.role === UserRole.CASHIER;
    const orgId = requestingUser.organizationId;
    const { storedAsTz, displayTz } = this.getReportTimezones();
    const orderLocalTs = `(COALESCE(order.completedAt, order.createdAt) AT TIME ZONE :storedAsTz) AT TIME ZONE :displayTz`;

    const applyFilters = (qb: any) => {
      qb.andWhere('order.status IN (:...saleStatuses)', {
        saleStatuses: SALE_STATUSES,
      }).andWhere(
        'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
      if (!isSuperAdmin) {
        qb.andWhere('order.organizationId = :orgId', { orgId });
      }
      if (isCashier) {
        qb.andWhere('order.cashierId = :cashierId', {
          cashierId: requestingUser.id,
        });
      }
      return qb;
    };

    const [
      summaryResult,
      dailyRows,
      topProductsRows,
      cashierRows,
      terminalRows,
      hourlyRows,
      recentOrderRows,
    ] = await Promise.all([
      // 1. Summary aggregates
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select('SUM(order.totalAmount)', 'totalRevenue')
          .addSelect('COUNT(order.id)', 'totalOrders')
          .where('1=1'),
      ).getRawOne(),

      // 2. Daily sales trend — GROUP BY date in the business timezone
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select(`TO_CHAR(${orderLocalTs}, 'YYYY-MM-DD')`, 'date')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .addSelect('COUNT(order.id)', 'orders')
          .where('1=1')
          .groupBy(`TO_CHAR(${orderLocalTs}, 'YYYY-MM-DD')`)
          .orderBy(`TO_CHAR(${orderLocalTs}, 'YYYY-MM-DD')`, 'ASC'),
      )
        .setParameter('storedAsTz', storedAsTz)
        .setParameter('displayTz', displayTz)
        .getRawMany(),

      // 3. Top products — GROUP BY (productId, name, sku) in order_items
      (() => {
        const qb = this.orderItemsRepository
          .createQueryBuilder('item')
          .innerJoin('item.order', 'order')
          .select('item.productId', 'productId')
          .addSelect('item.name', 'name')
          .addSelect('item.sku', 'sku')
          .addSelect('SUM(item.quantity)', 'totalQuantity')
          .addSelect('SUM(item.subtotal)', 'totalRevenue')
          .where('order.status IN (:...saleStatuses)', {
            saleStatuses: SALE_STATUSES,
          })
          .andWhere(
            'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
            {
              startDate,
              endDate,
            },
          );
        if (!isSuperAdmin) {
          qb.andWhere('order.organizationId = :orgId', { orgId });
        }
        if (isCashier) {
          qb.andWhere('order.cashierId = :cashierId', {
            cashierId: requestingUser.id,
          });
        }
        return qb
          .groupBy('item.productId')
          .addGroupBy('item.name')
          .addGroupBy('item.sku')
          .orderBy('SUM(item.subtotal)', 'DESC')
          .getRawMany();
      })(),

      // 4. Cashier performance — GROUP BY cashierId
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .leftJoin('order.cashier', 'cashier')
          .select('order.cashierId', 'cashierId')
          .addSelect(
            `COALESCE(cashier.name, "order"."cashierName", 'Unknown')`,
            'cashierName',
          )
          .addSelect('COUNT(order.id)', 'orders')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .where('1=1')
          .groupBy('order.cashierId')
          .addGroupBy('cashier.name')
          .addGroupBy('order.cashierName')
          .orderBy('SUM(order.totalAmount)', 'DESC'),
      ).getRawMany(),

      // 5. Terminal performance — GROUP BY terminalId
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .leftJoin('order.terminal', 'terminal')
          .select('order.terminalId', 'terminalId')
          .addSelect('terminal.name', 'terminalName')
          .addSelect('COUNT(order.id)', 'orders')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .where('1=1')
          .groupBy('order.terminalId')
          .addGroupBy('terminal.name')
          .orderBy('SUM(order.totalAmount)', 'DESC'),
      ).getRawMany(),

      // 6. Hourly pattern — GROUP BY hour in the business timezone
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select(`EXTRACT(HOUR FROM ${orderLocalTs})`, 'hour')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .addSelect('COUNT(order.id)', 'orders')
          .where('1=1')
          .groupBy(`EXTRACT(HOUR FROM ${orderLocalTs})`)
          .orderBy(`EXTRACT(HOUR FROM ${orderLocalTs})`, 'ASC'),
      )
        .setParameter('storedAsTz', storedAsTz)
        .setParameter('displayTz', displayTz)
        .getRawMany(),

      // 7. Recent orders (lightweight — for CSV export)
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select('order.id', 'id')
          .addSelect('COALESCE(order.completedAt, order.createdAt)', 'createdAt')
          .addSelect('order.totalAmount', 'totalAmount')
          .addSelect('order.status', 'status')
          .addSelect('COUNT(items.id)', 'itemCount')
          .leftJoin('order.items', 'items')
          .where('1=1')
          .groupBy('order.id')
          .addGroupBy('order.completedAt')
          .addGroupBy('order.createdAt')
          .addGroupBy('order.totalAmount')
          .addGroupBy('order.status')
          .orderBy('COALESCE(order.completedAt, order.createdAt)', 'DESC')
          .limit(10),
      ).getRawMany(),
    ]);

    const totalRevenue = parseFloat(summaryResult?.totalRevenue || '0');
    const totalOrders = parseInt(summaryResult?.totalOrders || '0', 10);
    const costOfGoods = await this.reportCostOfGoods(
      startDate,
      endDate,
      isSuperAdmin ? null : orgId,
      isCashier ? requestingUser.id : null,
    );
    const totalProfit = roundMoney(totalRevenue - costOfGoods);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalProfit,
        totalProducts: new Set(topProductsRows.map((r: any) => r.productId))
          .size,
      },
      salesTrend: dailyRows.map((r: any) => ({
        date: r.date,
        revenue: parseFloat(r.revenue || '0'),
        orders: parseInt(r.orders || '0', 10),
      })),
      topProducts: topProductsRows.map((r: any) => ({
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        totalQuantity: parseInt(r.totalQuantity || '0', 10),
        totalRevenue: parseFloat(r.totalRevenue || '0'),
      })),
      cashierPerformance: cashierRows.map((r: any) => ({
        cashierId: r.cashierId,
        name: r.cashierName || 'Unknown',
        orders: parseInt(r.orders || '0', 10),
        revenue: parseFloat(r.revenue || '0'),
      })),
      terminalPerformance: terminalRows.map((r: any) => ({
        terminalId: r.terminalId,
        name: r.terminalName || 'Unknown',
        orders: parseInt(r.orders || '0', 10),
        revenue: parseFloat(r.revenue || '0'),
      })),
      hourlySales: Array.from({ length: 24 }, (_, i) => {
        const row = hourlyRows.find((r: any) => parseInt(r.hour, 10) === i);
        return {
          hour: `${i}:00`,
          revenue: row ? parseFloat(row.revenue || '0') : 0,
          orders: row ? parseInt(row.orders || '0', 10) : 0,
        };
      }),
      recentOrders: recentOrderRows.map((r: any) => ({
        id: r.id,
        createdAt: r.createdAt,
        totalAmount: parseFloat(r.totalAmount || '0'),
        status: r.status,
        itemCount: parseInt(r.itemCount || '0', 10),
      })),
    };
  }

  async findOne(id: string, requestingUser: any) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (order.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Cashiers can only see their own orders
    if (requestingUser.role === UserRole.CASHIER) {
      if (order.cashierId !== requestingUser.id) {
        throw new ForbiddenException('Access denied to this order');
      }
    }

    return order;
  }

  /**
   * Full order for the inventory detail modal. The list endpoint stays light,
   * so items, payments, and the linked exchange order are loaded here.
   */
  async findDetail(id: string, requestingUser: any) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items', 'payments', 'terminal'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (order.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    if (requestingUser.role === UserRole.CASHIER) {
      if (order.cashierId !== requestingUser.id) {
        throw new ForbiddenException('Access denied to this order');
      }
    }

    const cashier = order.cashierId
      ? await this.dataSource.getRepository(UserEntity).findOne({
          where: { id: order.cashierId },
          select: { id: true, name: true },
        })
      : null;

    let originalOrderId: string | null = null;
    if (order.exchangeRef) {
      const original = await this.ordersRepository.findOne({
        where: [
          {
            orderNumber: order.exchangeRef,
            organizationId: order.organizationId,
          },
          {
            posLocalId: order.exchangeRef,
            organizationId: order.organizationId,
          },
        ],
        select: { id: true },
      });
      originalOrderId = original?.id ?? null;
    }

    const exchangeChild = await this.ordersRepository.findOne({
      where: [
        {
          exchangeRef: order.orderNumber,
          organizationId: order.organizationId,
        },
        {
          exchangeRef: order.posLocalId,
          organizationId: order.organizationId,
        },
      ],
      select: { id: true, orderNumber: true, returnedItems: true },
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      posLocalId: order.posLocalId,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      cashierName: order.cashierName,
      status: order.status,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      pointsRedeemed: order.pointsRedeemed,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      exchangeRef: order.exchangeRef,
      exchangedAt: order.exchangedAt,
      returnedItems: order.returnedItems,
      originalOrderId,
      exchangeChild: exchangeChild
        ? {
            id: exchangeChild.id,
            orderNumber: exchangeChild.orderNumber,
            returnedItems: exchangeChild.returnedItems,
          }
        : null,
      terminal: order.terminal
        ? { id: order.terminal.id, name: order.terminal.name }
        : null,
      cashier: cashier ? { id: cashier.id, name: cashier.name } : null,
      items: order.items ?? [],
      payments: (order.payments ?? []).map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference,
        status: payment.status,
      })),
    };
  }

  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
    requestingUser: any,
  ) {
    const order = await this.findOne(id, requestingUser);

    // Only allow status updates
    if (updateOrderDto.status) {
      order.status = updateOrderDto.status;

      if (updateOrderDto.status === OrderStatus.COMPLETED) {
        order.completedAt = new Date();
      }
    }

    if (updateOrderDto.discountAmount !== undefined) {
      order.discountAmount = updateOrderDto.discountAmount;
      // Recalculate total
      order.totalAmount =
        order.subtotal + order.taxAmount - order.discountAmount;
    }

    return this.ordersRepository.save(order);
  }

  async remove(id: string, requestingUser: any) {
    const order = await this.findOne(id, requestingUser);

    // Only admins can delete orders
    if (
      requestingUser.role !== UserRole.SUPER_ADMIN &&
      requestingUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions to delete orders');
    }

    // Cannot delete completed orders
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.SYNCED
    ) {
      throw new BadRequestException('Cannot delete completed or synced orders');
    }

    try {
      await this.ordersRepository.remove(order);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        // Handle foreign key constraint violations
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('foreign key constraint') ||
          errorMessage.includes('violates foreign key') ||
          errorMessage.includes('fk_')
        ) {
          throw new BadRequestException(
            'Cannot delete order as it has associated payments. Please remove all payments first.',
          );
        }
      }
      throw error;
    }
  }

  async syncOrder(id: string, requestingUser: any) {
    const order = await this.findOne(id, requestingUser);

    order.syncedAt = new Date();
    if (order.status === OrderStatus.COMPLETED) {
      order.status = OrderStatus.SYNCED;
    }

    return this.ordersRepository.save(order);
  }

  async voidOrder(id: string, requestingUser: any) {
    const order = await this.findOne(id, requestingUser);

    // Only managers and admins can void orders
    if (
      requestingUser.role !== UserRole.SUPER_ADMIN &&
      requestingUser.role !== UserRole.ADMIN &&
      requestingUser.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Insufficient permissions to void orders');
    }

    // Cannot void already voided orders
    if (order.status === OrderStatus.VOID) {
      throw new BadRequestException('Order is already voided');
    }

    // Use transaction to ensure atomic operation
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }
      if (lockedOrder.status === OrderStatus.VOID) {
        throw new BadRequestException('Order is already voided');
      }

      // Load order items
      const items = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: lockedOrder.id },
      });

      this.logger.log(`Voiding order ${lockedOrder.orderNumber} with ${items.length} items`);

      const stockLines = lockedOrder.exchangedAt
        ? quantitiesStillSold(items, lockedOrder.returnedItems || [])
        : items;
      const restoredCount = await this.restoreStock(
        queryRunner.manager,
        stockLines,
        lockedOrder.organizationId,
      );
      await this.refundCompletedPayments(queryRunner.manager, lockedOrder);
      await this.reverseLoyalty(queryRunner.manager, lockedOrder);

      // Update order status and void info
      lockedOrder.status = OrderStatus.VOID;
      lockedOrder.voidedBy = requestingUser.id;
      lockedOrder.voidedAt = new Date();

      await queryRunner.manager.save(OrderEntity, lockedOrder);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order ${lockedOrder.orderNumber} voided successfully. Stock restored for ${restoredCount} items.`,
      );

      return this.findOne(lockedOrder.id, requestingUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to void order ${order.orderNumber}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Receipt scan and exchange are store-wide: any cashier in the organization
   * can look up a receipt and exchange it, not only the cashier who rang it.
   */
  private async findInOrganization(id: string, requestingUser: any) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      requestingUser.role !== UserRole.SUPER_ADMIN &&
      order.organizationId !== requestingUser.organizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string, requestingUser: any) {
    const normalized = orderNumber?.trim();
    if (!normalized) {
      throw new BadRequestException('Order number is required');
    }

    const order = await this.ordersRepository.findOne({
      where: { orderNumber: normalized },
      relations: ['items', 'payments'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      requestingUser.role !== UserRole.SUPER_ADMIN &&
      order.organizationId !== requestingUser.organizationId
    ) {
      throw new NotFoundException('Order not found');
    }

    const exchangeChild = await this.ordersRepository.findOne({
      where: {
        exchangeRef: order.orderNumber,
        organizationId: order.organizationId,
      },
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      posLocalId: order.posLocalId,
      terminalId: order.terminalId,
      cashierId: order.cashierId,
      cashierName: order.cashierName,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      customerId: order.customerId,
      pointsEarned: order.pointsEarned,
      pointsRedeemed: order.pointsRedeemed,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      status: order.status,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      exchangeRef: order.exchangeRef,
      exchangedAt: order.exchangedAt,
      returnedItems: order.returnedItems,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discountAmount: item.discountAmount,
        subtotal: item.subtotal,
        total: item.total,
      })),
      payments: (order.payments ?? []).map((payment) => ({
        id: payment.id,
        posLocalId: payment.posLocalId,
        paymentNumber: payment.paymentNumber,
        terminalId: payment.terminalId,
        method: payment.method,
        amount: payment.amount,
        status: payment.status,
        reference: payment.reference,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
      exchangeChildOrderNumber: exchangeChild?.orderNumber ?? null,
    };
  }

  async exchangeOrder(
    id: string,
    dto: ExchangeOrderDto,
    requestingUser: any,
  ) {
    const order = await this.findInOrganization(id, requestingUser);

    if (order.exchangedAt) {
      throw new BadRequestException('Order has already been exchanged');
    }

    if (order.status === OrderStatus.VOID) {
      throw new BadRequestException('Cannot exchange a voided order');
    }

    // Use a transaction so restocking returned items and marking the order
    // as exchanged happen atomically.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedOrder = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }
      if (lockedOrder.exchangedAt) {
        throw new BadRequestException('Order has already been exchanged');
      }
      if (lockedOrder.status === OrderStatus.VOID) {
        throw new BadRequestException('Cannot exchange a voided order');
      }

      const returnedItems = dto.returnedItems ?? [];
      const saleLines = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: lockedOrder.id },
      });
      const stampedReturns = stampReturnUnitCosts(
        returnedItems,
        unitCostByProduct(saleLines),
      );

      this.logger.log(
        `Exchanging order ${lockedOrder.orderNumber} — restoring stock for ${returnedItems.length} returned item(s)`,
      );

      const restoredCount = await this.restoreStock(
        queryRunner.manager,
        returnedItems,
        lockedOrder.organizationId,
      );

      lockedOrder.exchangedAt = dto.exchangedAt ? new Date(dto.exchangedAt) : new Date();
      lockedOrder.returnedItems = stampedReturns.map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        ...(item.unitCost != null ? { unitCost: item.unitCost } : {}),
      }));
      await queryRunner.manager.save(OrderEntity, lockedOrder);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order ${lockedOrder.orderNumber} exchanged successfully. Stock restored for ${restoredCount} returned item(s).`,
      );

      return this.findInOrganization(lockedOrder.id, requestingUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to exchange order ${order.orderNumber}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async restoreStock(
    manager: EntityManager,
    items: Array<{ productId?: string; quantity?: unknown; name?: string }>,
    organizationId?: string | null,
  ) {
    const lines = (items || []).filter(
      (item) => item.productId && !String(item.productId).startsWith('manual-'),
    );
    const totals = new Map(
      quantitiesStillSold(lines).map((line) => [line.productId, line.quantity]),
    );
    let restored = 0;
    for (const productId of [...totals.keys()].sort()) {
      const quantity = totals.get(productId) || 0;
      const affected = await adjustTrackedStock(
        manager,
        productId,
        quantity,
        organizationId,
      );
      if (affected > 0) {
        this.logger.log(`Restored ${quantity} units of product ${productId}`);
        restored += 1;
        continue;
      }
      const product = await manager.findOne(ProductEntity, {
        where: organizationId
          ? { id: productId, organizationId }
          : { id: productId },
      });
      if (product?.infiniteStock) {
        this.logger.log(
          `Skipping stock restoration for unlimited stock product: ${product.name}`,
        );
      } else {
        this.logger.warn(
          `Product not found for stock restoration: ${productId}`,
        );
      }
    }
    return restored;
  }

  /**
   * Marks every completed payment on the order refunded and writes the
   * balancing refund row. The amount still unpaid after earlier partial
   * refunds is what gets written.
   */
  private async refundCompletedPayments(
    manager: EntityManager,
    order: OrderEntity,
  ) {
    const payments = await manager.find(PaymentEntity, {
      where: { orderId: order.id, status: PaymentStatus.COMPLETED },
    });
    for (const payment of payments) {
      const prior = await manager.find(PaymentEntity, {
        where: { reference: `REFUND-${payment.id}` },
      });
      const already = prior.reduce(
        (sum, row) => sum + Math.abs(roundMoney(row.amount)),
        0,
      );
      const remaining = roundMoney(roundMoney(payment.amount) - already);
      if (remaining > 0) {
        const suffix = `${Date.now().toString(36)}${randomUUID().slice(0, 8)}`.toUpperCase();
        await manager.save(
          PaymentEntity,
          manager.create(PaymentEntity, {
            paymentNumber: `RFD-${suffix}`,
            posLocalId: randomUUID(),
            orderId: payment.orderId,
            terminalId: payment.terminalId,
            organizationId: payment.organizationId,
            method: payment.method,
            amount: -remaining,
            status: PaymentStatus.REFUNDED,
            reference: `REFUND-${payment.id}`,
            processedAt: new Date(),
          }),
        );
      }
      payment.status = PaymentStatus.REFUNDED;
      await manager.save(PaymentEntity, payment);
    }
  }

  /**
   * Puts loyalty back to where it was before the sale. Earned points that
   * already expired are left alone. The earn row is closed so the expiry
   * job does not take the same points again.
   */
  private async reverseLoyalty(manager: EntityManager, order: OrderEntity) {
    if (!order.customerId) return;
    const customer = await manager.findOne(CustomerEntity, {
      where: { id: order.customerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!customer) return;

    const earned = Math.max(0, Math.floor(Number(order.pointsEarned) || 0));
    const redeemed = Math.max(0, Math.floor(Number(order.pointsRedeemed) || 0));
    let points = Number(customer.totalPoints) || 0;

    if (earned > 0) {
      const earnTx = await manager.findOne(CustomerPointTransactionEntity, {
        where: {
          orderId: order.id,
          type: PointTransactionType.EARN,
          expiredAt: IsNull(),
        },
      });
      if (earnTx) {
        points = Math.max(0, points - earned);
        earnTx.expiredAt = new Date();
        await manager.save(CustomerPointTransactionEntity, earnTx);
        await manager.save(
          CustomerPointTransactionEntity,
          manager.create(CustomerPointTransactionEntity, {
            customerId: customer.id,
            orderId: order.id,
            organizationId: order.organizationId,
            type: PointTransactionType.REDEEM,
            points: earned,
            description: `Voided order ${order.orderNumber}: reversed ${earned} earned pts`,
          }),
        );
      }
    }

    if (redeemed > 0) {
      points += redeemed;
      await manager.save(
        CustomerPointTransactionEntity,
        manager.create(CustomerPointTransactionEntity, {
          customerId: customer.id,
          orderId: order.id,
          organizationId: order.organizationId,
          type: PointTransactionType.EARN,
          points: redeemed,
          description: `Voided order ${order.orderNumber}: restored ${redeemed} redeemed pts`,
        }),
      );
    }

    customer.totalPoints = points;
    customer.totalSpent = Math.max(
      0,
      roundMoney(Number(customer.totalSpent) - Number(order.totalAmount)),
    );
    await manager.save(CustomerEntity, customer);
  }

  /** Cost of the units sold in the range, minus the cost of units returned. */
  private async reportCostOfGoods(
    startDate: string,
    endDate: string,
    organizationId: string | null,
    cashierId: string | null,
  ) {
    const params: unknown[] = [startDate, endDate];
    const orgSql = organizationId
      ? `AND o."organizationId" = $${params.push(organizationId)}`
      : '';
    const cashierSql = cashierId
      ? `AND o."cashierId" = $${params.push(cashierId)}`
      : '';
    const [soldRow] = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(
        i."quantity" * CASE
          WHEN i."unitCost" IS NOT NULL THEN i."unitCost"
          ELSE COALESCE(p."cost", 0)
        END
      ), 0) AS total
      FROM "order_items" i
      INNER JOIN "orders" o ON o."id" = i."orderId"
      LEFT JOIN "products" p
        ON p."id"::text = i."productId"
       AND p."organizationId" = o."organizationId"
      WHERE o."status"::text IN (${SALE_STATUS_SQL})
        AND COALESCE(o."completedAt", o."createdAt") BETWEEN $1 AND $2
        AND COALESCE(i."productId", '') <> ''
        AND i."productId" NOT LIKE 'manual-%'
        ${orgSql}
        ${cashierSql}
      `,
      params,
    );
    const [returnedRow] = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(
        CASE
          WHEN elem->>'quantity' ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN (elem->>'quantity')::numeric
          ELSE 0
        END * COALESCE(
          CASE
            WHEN elem->>'unitCost' ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN (elem->>'unitCost')::numeric
          END,
          p."cost",
          0
        )
      ), 0) AS total
      FROM "orders" o
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(o."returnedItems", '[]'::jsonb)
      ) AS elem
      LEFT JOIN "products" p
        ON p."id"::text = elem->>'productId'
       AND p."organizationId" = o."organizationId"
      WHERE o."status"::text <> 'VOID'
        AND o."exchangedAt" BETWEEN $1 AND $2
        AND COALESCE(elem->>'productId', '') <> ''
        AND elem->>'productId' NOT LIKE 'manual-%'
        ${orgSql}
        ${cashierSql}
      `,
      params,
    );
    return roundMoney(
      roundMoney(soldRow?.total) - roundMoney(returnedRow?.total),
    );
  }

  async getOrderStats(requestingUser: any) {
    const query = this.ordersRepository.createQueryBuilder('order');

    // Filter by organization
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('order.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    // Cashiers can only see their own stats
    if (requestingUser.role === UserRole.CASHIER) {
      query.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    // Exclude voided orders from all statistics
    query.andWhere('order.status != :voidStatus', { voidStatus: OrderStatus.VOID });

    const [totalOrders, completedOrders, totalRevenue] = await Promise.all([
      query.getCount(),
      query
        .clone()
        .andWhere('order.status IN (:...statuses)', {
          statuses: SALE_STATUSES,
        })
        .getCount(),
      query
        .clone()
        .select('SUM(order.totalAmount)', 'total')
        .andWhere('order.status IN (:...statuses)', {
          statuses: SALE_STATUSES,
        })
        .getRawOne()
        .then((result) => parseFloat(result?.total || 0)),
    ]);

    return {
      totalOrders,
      completedOrders,
      totalRevenue,
    };
  }

  async getManualItems(requestingUser: any) {
    const query = this.orderItemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .where('item.sku = :sku', { sku: 'MANUAL' })
      .andWhere('order.status != :voidStatus', { voidStatus: OrderStatus.VOID })
      .orderBy('COALESCE(order.completedAt, order.createdAt)', 'DESC');

    // Filter by organization
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.andWhere('order.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    // Cashiers can only see their own manual items
    if (requestingUser.role === UserRole.CASHIER) {
      query.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    return query.getMany();
  }
}

function roundMoney(value: unknown): number {
  const amount = parseFloat(String(value ?? '0'));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}
