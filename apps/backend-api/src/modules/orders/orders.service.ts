import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { OrderItemEntity } from '../../entities/order-item.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { UserRole, OrderStatus } from '@pos/shared-types';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private ordersRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private orderItemsRepository: Repository<OrderItemEntity>,
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
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.terminal', 'terminal')
      .leftJoinAndSelect('order.cashier', 'cashier')
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

    await this.ordersRepository.remove(order);
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

    if (order.status === OrderStatus.SYNCED) {
      throw new BadRequestException('Cannot void synced orders');
    }

    order.status = OrderStatus.VOID;
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

    const [totalOrders, completedOrders, totalRevenue] = await Promise.all([
      query.getCount(),
      query
        .clone()
        .where('order.status = :status', { status: OrderStatus.COMPLETED })
        .getCount(),
      query
        .clone()
        .select('SUM(order.totalAmount)', 'total')
        .where('order.status = :status', { status: OrderStatus.COMPLETED })
        .getRawOne()
        .then((result) => parseFloat(result?.total || 0)),
    ]);

    return {
      totalOrders,
      completedOrders,
      totalRevenue,
    };
  }
}
