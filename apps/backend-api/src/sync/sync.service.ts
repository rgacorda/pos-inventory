import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SyncRequestDto,
  SyncResponseDto,
  SyncStatus,
  SyncResultDto,
  CreateOrderDto,
  CreatePaymentDto,
  OrderStatus,
  PaymentStatus,
  ProductCatalogDto,
  ProductStatus,
} from '@pos/shared-types';
import { OrderEntity } from '../entities/order.entity';
import { OrderItemEntity } from '../entities/order-item.entity';
import { PaymentEntity } from '../entities/payment.entity';
import { ProductEntity } from '../entities/product.entity';
import { TerminalEntity } from '../entities/terminal.entity';
import { UserEntity } from '../entities/user.entity';
import { CustomerEntity } from '../entities/customer.entity';
import {
  CustomerPointTransactionEntity,
  PointTransactionType,
} from '../entities/customer-point-transaction.entity';
import { OrganizationEntity } from '../entities/organization.entity';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(ProductEntity)
    private productRepository: Repository<ProductEntity>,
    @InjectRepository(TerminalEntity)
    private terminalRepository: Repository<TerminalEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CustomerEntity)
    private customerRepository: Repository<CustomerEntity>,
    @InjectRepository(CustomerPointTransactionEntity)
    private pointTransactionRepository: Repository<CustomerPointTransactionEntity>,
    @InjectRepository(OrganizationEntity)
    private organizationRepository: Repository<OrganizationEntity>,
    private dataSource: DataSource,
  ) {}

  async processSync(
    syncRequest: SyncRequestDto,
    user?: any,
  ): Promise<SyncResponseDto> {
    this.logger.log(
      `Processing sync for terminal: ${syncRequest.terminalId} by user: ${user?.email || 'anonymous'}`,
    );

    const syncedAt = new Date();
    const orderResults: SyncResultDto[] = [];
    const paymentResults: SyncResultDto[] = [];

    // Process orders in parallel batches of 5 to avoid overwhelming the DB
    // while still being much faster than fully sequential processing.
    const ORDER_PARALLEL = 5;
    for (let i = 0; i < syncRequest.orders.length; i += ORDER_PARALLEL) {
      const batch = syncRequest.orders.slice(i, i + ORDER_PARALLEL);
      const results = await Promise.all(
        batch.map((dto) => this.processOrder(dto, user)),
      );
      orderResults.push(...results);
    }

    // Process payments in parallel batches of 5
    const PAYMENT_PARALLEL = 5;
    for (let i = 0; i < syncRequest.payments.length; i += PAYMENT_PARALLEL) {
      const batch = syncRequest.payments.slice(i, i + PAYMENT_PARALLEL);
      const results = await Promise.all(
        batch.map((dto) => this.processPayment(dto, user)),
      );
      paymentResults.push(...results);
    }

    // Update terminal last sync time
    await this.updateTerminalSync(syncRequest.terminalId, syncedAt);

    // Only fetch the product catalog when the POS is not uploading orders/payments.
    // Fetching the full catalog on every order-sync batch is wasteful and adds
    // significant latency during backlog recovery.
    const hasPendingData =
      syncRequest.orders.length > 0 || syncRequest.payments.length > 0;
    const catalog = hasPendingData
      ? undefined
      : await this.getProductCatalog(syncRequest.lastSyncAt, user);

    return {
      status: SyncStatus.SUCCESS,
      syncedAt,
      results: {
        orders: orderResults,
        payments: paymentResults,
      },
      catalog,
    };
  }

  private async processOrder(
    orderDto: CreateOrderDto,
    user?: any,
  ): Promise<SyncResultDto> {
    try {
      // Check for duplicate using posLocalId (idempotent)
      const existing = await this.orderRepository.findOne({
        where: { posLocalId: orderDto.posLocalId },
      });

      if (existing) {
        this.logger.log(`Order already synced: ${orderDto.posLocalId}`);
        return {
          posLocalId: orderDto.posLocalId,
          status: 'DUPLICATE',
          serverId: existing.id,
          message: 'Order already exists',
        };
      }

      // Create order in transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Look up terminal UUID from terminalId string
        const terminal = await queryRunner.manager.findOne(TerminalEntity, {
          where: { terminalId: orderDto.terminalId },
        });
        if (!terminal) {
          throw new Error(`Terminal not found: ${orderDto.terminalId}`);
        }

        // Look up cashier UUID from cashierId (if it's not already a UUID)
        let cashierUuid: string | undefined = orderDto.cashierId;
        if (orderDto.cashierId && !this.isUUID(orderDto.cashierId)) {
          const cashier = await queryRunner.manager.findOne(UserEntity, {
            where: { email: orderDto.cashierId },
          });
          // If the value isn't a UUID and can't be resolved by email, treat as unknown
          cashierUuid = cashier ? cashier.id : undefined;
        }

        // Generate order number
        const orderNumber = await this.generateOrderNumber();

        // Resolve customer if provided (exchange orders never earn/redeem points)
        const isExchangeOrder = !!orderDto.exchangeRef;
        let resolvedCustomerId: string | undefined;
        if (orderDto.customerId && !isExchangeOrder) {
          const customer = await queryRunner.manager.findOne(CustomerEntity, {
            where: { id: orderDto.customerId, organizationId: user?.organizationId },
          });
          if (customer) {
            resolvedCustomerId = customer.id;
          }
        }

        // Fetch org loyalty settings to determine expiry date
        const org = user?.organizationId
          ? await queryRunner.manager.findOne(OrganizationEntity, {
              where: { id: user.organizationId },
            })
          : null;
        const loyaltyExpiryDays = org?.settings?.loyaltyExpiryDays ?? null;

        // Compute expiry date for newly earned points
        const earnExpiresAt = loyaltyExpiryDays
          ? new Date(Date.now() + loyaltyExpiryDays * 24 * 60 * 60 * 1000)
          : null;

        // Compute points earned on the net amount paid (after any redemption)
        const amountPaid = Number(orderDto.totalAmount);
        const pointsRedeemed = (!isExchangeOrder && orderDto.pointsRedeemed) ? orderDto.pointsRedeemed : 0;
        const pointsEarned = resolvedCustomerId
          ? Math.floor(amountPaid / 200)
          : undefined;

        // Create order entity
        const order = this.orderRepository.create({
          orderNumber,
          posLocalId: orderDto.posLocalId,
          terminalId: terminal.id,
          cashierId: cashierUuid,
          organizationId: user?.organizationId,
          subtotal: orderDto.subtotal,
          taxAmount: orderDto.taxAmount,
          discountAmount: orderDto.discountAmount,
          totalAmount: orderDto.totalAmount,
          status: isExchangeOrder ? OrderStatus.EXCHANGE : OrderStatus.SYNCED,
          completedAt: orderDto.completedAt,
          syncedAt: new Date(),
          customerName: orderDto.customerName,
          customerAddress: orderDto.customerAddress,
          customerId: resolvedCustomerId,
          pointsEarned: isExchangeOrder ? undefined : pointsEarned,
          pointsRedeemed: isExchangeOrder ? undefined : orderDto.pointsRedeemed,
          exchangeRef: isExchangeOrder ? orderDto.exchangeRef : undefined,
        });

        const savedOrder = await queryRunner.manager.save(order);

        // If this is an exchange order, mark the original order as exchanged
        if (isExchangeOrder && orderDto.exchangeRef) {
          const originalOrder = await queryRunner.manager.findOne(OrderEntity, {
            where: { orderNumber: orderDto.exchangeRef },
          });
          if (originalOrder && !originalOrder.exchangedAt) {
            originalOrder.exchangedAt = orderDto.completedAt
              ? new Date(orderDto.completedAt)
              : new Date();
            await queryRunner.manager.save(OrderEntity, originalOrder);
          }
        }

        // Create order items
        const items = orderDto.items.map((item) => {
          const orderItem = new OrderItemEntity();
          orderItem.orderId = savedOrder.id;
          orderItem.productId = item.productId;
          orderItem.sku = item.sku;
          orderItem.name = item.name;
          orderItem.quantity = item.quantity;
          orderItem.unitPrice = item.unitPrice;
          orderItem.taxRate = item.taxRate;
          orderItem.discountAmount = item.discountAmount;
          orderItem.subtotal = item.quantity * item.unitPrice;
          orderItem.total =
            orderItem.subtotal -
            item.discountAmount +
            orderItem.subtotal * item.taxRate;
          return orderItem;
        });

        await queryRunner.manager.save(OrderItemEntity, items);

        // Update inventory (accept sale even if stock goes negative)
        // Skip manual items (they have IDs starting with 'manual-')
        for (const item of orderDto.items) {
          // Skip inventory update for manual items
          if (item.productId.startsWith('manual-')) {
            this.logger.log(
              `Skipping inventory update for manual item: ${item.name}`,
            );
            continue;
          }

          // Check if product exists before decrementing
          const product = await queryRunner.manager.findOne(ProductEntity, {
            where: { id: item.productId },
          });

          if (product) {
            await queryRunner.manager.decrement(
              ProductEntity,
              { id: item.productId },
              'stockQuantity',
              item.quantity,
            );
          } else {
            this.logger.warn(
              `Product not found for inventory update: ${item.productId} (${item.name})`,
            );
          }
        }

        // Process customer points
        if (resolvedCustomerId && user?.organizationId) {
          // First: handle redemption (deduct points)
          if (pointsRedeemed > 0) {
            await queryRunner.manager.decrement(
              CustomerEntity,
              { id: resolvedCustomerId },
              'totalPoints',
              pointsRedeemed,
            );
            await queryRunner.manager.save(CustomerPointTransactionEntity,
              queryRunner.manager.create(CustomerPointTransactionEntity, {
                customerId: resolvedCustomerId,
                orderId: savedOrder.id,
                organizationId: user.organizationId,
                type: PointTransactionType.REDEEM,
                points: pointsRedeemed,
                description: `Redeemed ${pointsRedeemed} pts on Order ${orderNumber} (−₱${pointsRedeemed.toFixed(2)})`,
              }),
            );
          }

          // Then: earn points on net amount paid
          if (pointsEarned && pointsEarned > 0) {
            await queryRunner.manager.increment(
              CustomerEntity,
              { id: resolvedCustomerId },
              'totalPoints',
              pointsEarned,
            );
            await queryRunner.manager.increment(
              CustomerEntity,
              { id: resolvedCustomerId },
              'totalSpent',
              amountPaid,
            );
            const expiryNote = earnExpiresAt
              ? `, expires ${earnExpiresAt.toLocaleDateString()}`
              : '';
            await queryRunner.manager.save(CustomerPointTransactionEntity,
              queryRunner.manager.create(CustomerPointTransactionEntity, {
                customerId: resolvedCustomerId,
                orderId: savedOrder.id,
                organizationId: user.organizationId,
                type: PointTransactionType.EARN,
                points: pointsEarned,
                expiresAt: earnExpiresAt ?? undefined,
                description: `Earned ${pointsEarned} pts from Order ${orderNumber} (₱${amountPaid.toFixed(2)} spent${expiryNote})`,
              }),
            );
          }
        }

        await queryRunner.commitTransaction();

        this.logger.log(`Order synced successfully: ${orderDto.posLocalId}`);
        return {
          posLocalId: orderDto.posLocalId,
          status: 'SUCCESS',
          serverId: savedOrder.id,
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to sync order ${orderDto.posLocalId}: ${errorMessage}`,
      );
      return {
        posLocalId: orderDto.posLocalId,
        status: 'ERROR',
        message: errorMessage,
      };
    }
  }

  private async processPayment(
    paymentDto: CreatePaymentDto,
    user?: any,
  ): Promise<SyncResultDto> {
    try {
      // Check for duplicate using posLocalId (idempotent)
      const existing = await this.paymentRepository.findOne({
        where: { posLocalId: paymentDto.posLocalId },
      });

      if (existing) {
        this.logger.log(`Payment already synced: ${paymentDto.posLocalId}`);
        return {
          posLocalId: paymentDto.posLocalId,
          status: 'DUPLICATE',
          serverId: existing.id,
          message: 'Payment already exists',
        };
      }

      // Find order by posLocalId (payments always reference orders by posLocalId)
      const order = await this.orderRepository.findOne({
        where: { posLocalId: paymentDto.orderPosLocalId },
      });

      if (!order) {
        this.logger.error(
          `Order not found for payment ${paymentDto.posLocalId}. Looking for order with posLocalId: ${paymentDto.orderPosLocalId}`,
        );
        throw new Error(
          `Order not found with posLocalId: ${paymentDto.orderPosLocalId}`,
        );
      }

      const orderId = order.id;

      // Look up terminal UUID from terminalId string
      const terminal = await this.terminalRepository.findOne({
        where: { terminalId: paymentDto.terminalId },
      });
      if (!terminal) {
        throw new Error(`Terminal not found: ${paymentDto.terminalId}`);
      }

      // Generate payment number
      const paymentNumber = await this.generatePaymentNumber();

      // Create payment
      const payment = this.paymentRepository.create({
        paymentNumber,
        posLocalId: paymentDto.posLocalId,
        orderId,
        terminalId: terminal.id,
        organizationId: user?.organizationId,
        method: paymentDto.method,
        amount: paymentDto.amount,
        status: PaymentStatus.COMPLETED,
        reference: paymentDto.reference,
        processedAt: paymentDto.processedAt,
        syncedAt: new Date(),
      });

      const savedPayment = await this.paymentRepository.save(payment);

      this.logger.log(`Payment synced successfully: ${paymentDto.posLocalId}`);
      return {
        posLocalId: paymentDto.posLocalId,
        status: 'SUCCESS',
        serverId: savedPayment.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to sync payment ${paymentDto.posLocalId}: ${errorMessage}`,
      );
      return {
        posLocalId: paymentDto.posLocalId,
        status: 'ERROR',
        message: errorMessage,
      };
    }
  }

  private async updateTerminalSync(
    terminalId: string,
    syncedAt: Date,
  ): Promise<void> {
    await this.terminalRepository.update(
      { terminalId },
      { lastSyncAt: syncedAt },
    );
  }

  private async getProductCatalog(
    lastSyncAt?: Date,
    user?: any,
  ): Promise<ProductCatalogDto> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    // Filter by organization for non-super-admins
    if (user?.organizationId) {
      queryBuilder.andWhere('product.organizationId = :orgId', {
        orgId: user.organizationId,
      });
    }

    const products = await queryBuilder.getMany();

    return {
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        price: Number(p.price),
        cost: p.cost ? Number(p.cost) : undefined,
        packPrice: p.packPrice ? Number(p.packPrice) : undefined,
        packQuantity: p.packQuantity,
        addonPrice: p.addonPrice ? Number(p.addonPrice) : undefined,
        convenienceMarkupPercentage: p.convenienceMarkupPercentage ? Number(p.convenienceMarkupPercentage) : undefined,
        convenienceMarkup: p.convenienceMarkup ? Number(p.convenienceMarkup) : undefined,
        taxRate: Number(p.taxRate),
        barcode: p.barcode,
        imageUrl: p.imageUrl,
        status: p.status,
        stockQuantity: p.stockQuantity,
      })),
      lastUpdated: new Date(),
    };
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}${random}`;
  }

  private async generatePaymentNumber(): Promise<string> {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `PAY-${timestamp}${random}`;
  }

  private isUUID(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
