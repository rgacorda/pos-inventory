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
import { UserRole, OrderStatus } from '@pos/shared-types';

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
    filters?: { status?: OrderStatus; terminalId?: string },
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

    // Cashiers can only see their own orders
    if (requestingUser.role === UserRole.CASHIER) {
      query.andWhere('order.cashierId = :cashierId', {
        cashierId: requestingUser.id,
      });
    }

    return query.getMany();
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
