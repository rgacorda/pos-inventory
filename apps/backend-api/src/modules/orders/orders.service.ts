import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, DataSource } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { OrderItemEntity } from '../../entities/order-item.entity';
import { ProductEntity } from '../../entities/product.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { UserRole, OrderStatus, ExchangeOrderDto } from '@pos/shared-types';

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

    // Create order
    const order = this.ordersRepository.create({
      ...createOrderDto,
      items: undefined, // Remove items from spread, we'll add them separately
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Create order items
    const orderItems = items.map((item) =>
      this.orderItemsRepository.create({
        ...item,
        orderId: savedOrder.id,
      }),
    );

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
    },
  ) {
    const query = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.terminal', 'terminal')
      .leftJoinAndSelect('order.cashier', 'cashier')
      .leftJoinAndSelect('order.payments', 'payments')
      .orderBy('order.createdAt', 'DESC');

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
      query.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    // Cashiers can only see their own orders
    if (requestingUser.role === UserRole.CASHIER) {
      query.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    return query.getMany();
  }

  async getDashboardStats(requestingUser: any) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999,
    );

    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'revenue')
      .addSelect('COUNT(order.id)', 'orderCount')
      .where('order.status != :voidStatus', { voidStatus: OrderStatus.VOID })
      .andWhere('order.createdAt BETWEEN :start AND :end', {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
      });

    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      qb.andWhere('order.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    if (requestingUser.role === UserRole.CASHIER) {
      qb.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    const result = await qb.getRawOne();
    const revenue = parseFloat(result?.revenue || '0');
    const orders = parseInt(result?.orderCount || '0', 10);

    return {
      today: {
        revenue,
        orders,
        averageOrderValue: orders > 0 ? revenue / orders : 0,
      },
    };
  }

  async getReportAnalytics(
    requestingUser: any,
    startDate: string,
    endDate: string,
  ) {
    const isSuperAdmin = requestingUser.role === UserRole.SUPER_ADMIN;
    const isCashier = requestingUser.role === UserRole.CASHIER;
    const orgId = requestingUser.organizationId;

    const applyFilters = (qb: any) => {
      qb.andWhere('order.status != :voidStatus', {
        voidStatus: OrderStatus.VOID,
      }).andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
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
          .addSelect('SUM(order.taxAmount)', 'totalTax')
          .addSelect('COUNT(order.id)', 'totalOrders')
          .where('1=1'),
      ).getRawOne(),

      // 2. Daily sales trend — GROUP BY date in SQL
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", 'date')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .addSelect('COUNT(order.id)', 'orders')
          .where('1=1')
          .groupBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')")
          .orderBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", 'ASC'),
      ).getRawMany(),

      // 3. Top products — GROUP BY (productId, name, sku) in order_items
      (() => {
        const qb = this.orderItemsRepository
          .createQueryBuilder('item')
          .innerJoin('item.order', 'order')
          .select('item.productId', 'productId')
          .addSelect('item.name', 'name')
          .addSelect('item.sku', 'sku')
          .addSelect('SUM(item.quantity)', 'totalQuantity')
          .addSelect('SUM(item.quantity * item.unitPrice)', 'totalRevenue')
          .where('order.status != :voidStatus', {
            voidStatus: OrderStatus.VOID,
          })
          .andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          });
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
          .orderBy('SUM(item.quantity * item.unitPrice)', 'DESC')
          .getRawMany();
      })(),

      // 4. Cashier performance — GROUP BY cashierId
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .leftJoin('order.cashier', 'cashier')
          .select('order.cashierId', 'cashierId')
          .addSelect('cashier.name', 'cashierName')
          .addSelect('COUNT(order.id)', 'orders')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .where('1=1')
          .groupBy('order.cashierId')
          .addGroupBy('cashier.name')
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

      // 6. Hourly pattern — GROUP BY hour
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select('EXTRACT(HOUR FROM order.createdAt)', 'hour')
          .addSelect('SUM(order.totalAmount)', 'revenue')
          .addSelect('COUNT(order.id)', 'orders')
          .where('1=1')
          .groupBy('EXTRACT(HOUR FROM order.createdAt)')
          .orderBy('EXTRACT(HOUR FROM order.createdAt)', 'ASC'),
      ).getRawMany(),

      // 7. Recent orders (lightweight — for CSV export)
      applyFilters(
        this.ordersRepository
          .createQueryBuilder('order')
          .select('order.id', 'id')
          .addSelect('order.createdAt', 'createdAt')
          .addSelect('order.totalAmount', 'totalAmount')
          .addSelect('order.status', 'status')
          .addSelect('COUNT(items.id)', 'itemCount')
          .leftJoin('order.items', 'items')
          .where('1=1')
          .groupBy('order.id')
          .addGroupBy('order.createdAt')
          .addGroupBy('order.totalAmount')
          .addGroupBy('order.status')
          .orderBy('order.createdAt', 'DESC')
          .limit(10),
      ).getRawMany(),
    ]);

    const totalRevenue = parseFloat(summaryResult?.totalRevenue || '0');
    const totalTax = parseFloat(summaryResult?.totalTax || '0');
    const totalOrders = parseInt(summaryResult?.totalOrders || '0', 10);
    const totalProfit = totalRevenue - totalTax;
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
      // Load order items
      const items = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: order.id },
      });

      this.logger.log(`Voiding order ${order.orderNumber} with ${items.length} items`);

      // Restore stock for each item (except manual items)
      let restoredCount = 0;
      for (const item of items) {
        // Skip manual items (they don't affect stock)
        if (item.productId.startsWith('manual-')) {
          this.logger.log(`Skipping stock restoration for manual item: ${item.name}`);
          continue;
        }

        // Check if product exists
        const product = await queryRunner.manager.findOne(ProductEntity, {
          where: { id: item.productId },
        });

        if (product) {
          // Restore stock by adding back the quantity
          await queryRunner.manager.increment(
            ProductEntity,
            { id: item.productId },
            'stockQuantity',
            item.quantity,
          );
          
          this.logger.log(
            `Restored ${item.quantity} units of ${item.name} (${item.sku}) - Stock: ${product.stockQuantity} → ${product.stockQuantity + item.quantity}`,
          );
          restoredCount++;
        } else {
          this.logger.warn(
            `Product not found for stock restoration: ${item.productId} (${item.name})`,
          );
        }
      }

      // Update order status and void info
      order.status = OrderStatus.VOID;
      order.voidedBy = requestingUser.id;
      order.voidedAt = new Date();

      await queryRunner.manager.save(OrderEntity, order);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order ${order.orderNumber} voided successfully. Stock restored for ${restoredCount} items.`,
      );

      return this.findOne(order.id, requestingUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to void order ${order.orderNumber}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async exchangeOrder(
    id: string,
    dto: ExchangeOrderDto,
    requestingUser: any,
  ) {
    const order = await this.findOne(id, requestingUser);

    if (order.exchangedAt) {
      throw new BadRequestException('Order has already been exchanged');
    }

    if (order.status === OrderStatus.VOID) {
      throw new BadRequestException('Cannot exchange a voided order');
    }

    order.exchangedAt = dto.exchangedAt ? new Date(dto.exchangedAt) : new Date();
    return this.ordersRepository.save(order);
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
          statuses: [OrderStatus.COMPLETED, OrderStatus.SYNCED] 
        })
        .getCount(),
      query
        .clone()
        .select('SUM(order.totalAmount)', 'total')
        .andWhere('order.status IN (:...statuses)', { 
          statuses: [OrderStatus.COMPLETED, OrderStatus.SYNCED] 
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
      .orderBy('order.createdAt', 'DESC');

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
