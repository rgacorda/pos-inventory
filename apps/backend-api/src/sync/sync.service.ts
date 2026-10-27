import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, FindOptionsWhere } from 'typeorm';
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

    // Process regular sales before exchange orders so the original order
    // exists on the server when we look it up to restore returned stock.
    const regularOrders = syncRequest.orders.filter((o) => !o.exchangeRef);
    const exchangeOrders = syncRequest.orders.filter((o) => !!o.exchangeRef);

    const processOrderBatches = async (orders: CreateOrderDto[]) => {
      const ORDER_PARALLEL = 5;
      for (let i = 0; i < orders.length; i += ORDER_PARALLEL) {
        const batch = orders.slice(i, i + ORDER_PARALLEL);
        const results = await Promise.all(
          batch.map((dto) => this.processOrder(dto, user)),
        );
        orderResults.push(...results);
      }
    };

    await processOrderBatches(regularOrders);
    await processOrderBatches(exchangeOrders);

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
    const maxAttempts = 3;
    let lastResult: SyncResultDto | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      lastResult = await this.processOrderAttempt(orderDto, user);
      const retry =
        lastResult.status === 'ERROR' &&
        attempt < maxAttempts &&
        !!lastResult.message?.startsWith('RETRYABLE:');
      if (!retry) {
        if (lastResult.message?.startsWith('RETRYABLE:')) {
          return {
            ...lastResult,
            message: lastResult.message.slice('RETRYABLE:'.length).trim(),
          };
        }
        return lastResult;
      }
      this.logger.warn(
        `Retrying order ${orderDto.posLocalId} after transient error (attempt ${attempt}): ${lastResult.message}`,
      );
    }

    return (
      lastResult ?? {
        posLocalId: orderDto.posLocalId,
        status: 'ERROR',
        message: 'Sync failed',
      }
    );
  }

  private async processOrderAttempt(
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
        let cashierRecord: UserEntity | null = null;
        if (orderDto.cashierId && !this.isUUID(orderDto.cashierId)) {
          cashierRecord = await queryRunner.manager.findOne(UserEntity, {
            where: { email: orderDto.cashierId },
          });
          // If the value isn't a UUID and can't be resolved by email, treat as unknown
          cashierUuid = cashierRecord ? cashierRecord.id : undefined;
        } else if (cashierUuid) {
          cashierRecord = await queryRunner.manager.findOne(UserEntity, {
            where: { id: cashierUuid },
          });
          // A deleted cashier must not fail the sale. The name snapshot is kept.
          if (!cashierRecord) {
            cashierUuid = undefined;
          }
        }
        const cashierName = cashierRecord?.name ?? orderDto.cashierName;

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
        const amountPaid = this.toMoney(orderDto.totalAmount);
        const rawPoints = Number(orderDto.pointsRedeemed);
        const pointsRedeemed =
          !isExchangeOrder && Number.isFinite(rawPoints)
            ? Math.max(0, Math.floor(rawPoints))
            : 0;
        const pointsEarned = resolvedCustomerId
          ? Math.floor(amountPaid / 500)
          : undefined;

        // Use the actual completion time from the POS device, not the sync time,
        // so that an order synced late (e.g. after a sync error) still lands on the
        // day/time it actually happened rather than the day it happened to sync.
        const completedAt = this.resolveTimestamp(
          orderDto.completedAt,
          orderDto.posLocalId,
          'order',
        );

        // Resolve the original sale before inserting the exchange order so we
        // can store the server-side orderNumber as exchangeRef (Inventory
        // links original ↔ exchange by that number). POS-local order numbers
        // are never persisted on the server.
        const originalOrder = isExchangeOrder
          ? await this.findOriginalExchangeOrder(
              queryRunner,
              orderDto.exchangeRef,
              orderDto.originalPosLocalId,
              user?.organizationId,
            )
          : null;

        const returnedItems = isExchangeOrder
          ? (orderDto.returnedItems ?? [])
          : [];

        // Create order entity
        const order = this.orderRepository.create({
          orderNumber,
          posLocalId: orderDto.posLocalId,
          terminalId: terminal.id,
          cashierId: cashierUuid,
          cashierName,
          organizationId: user?.organizationId,
          subtotal: this.toMoney(orderDto.subtotal),
          taxAmount: this.toMoney(orderDto.taxAmount),
          discountAmount: this.toMoney(orderDto.discountAmount),
          totalAmount: amountPaid,
          status: isExchangeOrder ? OrderStatus.EXCHANGE : OrderStatus.SYNCED,
          completedAt,
          syncedAt: new Date(),
          customerName: orderDto.customerName,
          customerAddress: orderDto.customerAddress,
          customerId: resolvedCustomerId,
          pointsEarned: isExchangeOrder ? undefined : pointsEarned,
          pointsRedeemed: isExchangeOrder || pointsRedeemed <= 0 ? undefined : pointsRedeemed,
          exchangeRef: isExchangeOrder
            ? (originalOrder?.orderNumber ?? orderDto.exchangeRef)
            : undefined,
          returnedItems: isExchangeOrder && returnedItems.length > 0
            ? returnedItems
            : undefined,
        });

        const savedOrder = await queryRunner.manager.save(order);

        // If this is an exchange order, mark the original order as exchanged
        // and restore stock for the items that were returned. This is a
        // fallback path for when the POS couldn't call POST /orders/{id}/exchange
        // directly (e.g. offline, or the original order wasn't synced yet).
        // The `!originalOrder.exchangedAt` guard prevents double-restoring stock
        // if the direct exchange call already handled it.
        if (isExchangeOrder) {
          if (originalOrder && !originalOrder.exchangedAt) {
            originalOrder.exchangedAt = completedAt;
            originalOrder.returnedItems =
              returnedItems.length > 0
                ? returnedItems
                : originalOrder.returnedItems;
            await queryRunner.manager.save(OrderEntity, originalOrder);

            await this.restoreReturnedStock(
              queryRunner,
              returnedItems,
              `from exchange of order ${originalOrder.orderNumber} (via sync fallback)`,
            );
          } else if (!originalOrder) {
            this.logger.warn(
              `Original order not found for exchange ${orderDto.posLocalId} (exchangeRef=${orderDto.exchangeRef}, originalPosLocalId=${orderDto.originalPosLocalId}). Returned stock was not restored.`,
            );
          }
        }

        // Create order items. Coerce local values so one bad line (NaN price,
        // fractional quantity, tax rate that doesn't fit numeric(5,4)) cannot
        // reject the order on every retry.
        const items = (orderDto.items ?? []).map((item) => {
          const quantity = Math.max(0, Math.round(Number(item.quantity) || 0));
          const unitPrice = this.toMoney(item.unitPrice);
          const taxRate = this.toTaxRate(item.taxRate);
          const discountAmount = this.toMoney(item.discountAmount);
          const subtotal = this.toMoney(quantity * unitPrice);
          const orderItem = new OrderItemEntity();
          orderItem.orderId = savedOrder.id;
          orderItem.productId = item.productId ? String(item.productId) : '';
          orderItem.sku = item.sku || 'UNKNOWN';
          orderItem.name = item.name || 'Item';
          orderItem.quantity = quantity;
          orderItem.unitPrice = unitPrice;
          orderItem.taxRate = taxRate;
          orderItem.discountAmount = discountAmount;
          orderItem.subtotal = subtotal;
          orderItem.total = this.toMoney(
            subtotal - discountAmount + subtotal * taxRate,
          );
          return orderItem;
        });

        await queryRunner.manager.save(OrderItemEntity, items);

        // Update inventory (accept sale even if stock goes negative).
        // Skip manual items (they have IDs starting with 'manual-').
        // Sort by product id so parallel orders lock rows in the same order
        // and don't deadlock each other.
        const stockItems = [...(orderDto.items ?? [])]
          .map((item) => ({
            ...item,
            productId: item.productId ? String(item.productId) : '',
            quantity: Math.max(0, Math.round(Number(item.quantity) || 0)),
          }))
          .filter((item) => item.productId && item.quantity > 0)
          .sort((a, b) => a.productId.localeCompare(b.productId));

        for (const item of stockItems) {
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

          if (product?.infiniteStock) {
            this.logger.log(
              `Skipping inventory update for unlimited stock product: ${item.name}`,
            );
          } else if (product) {
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
      if (this.isPosLocalIdConflict(error)) {
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
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const retriable = this.isUniqueViolation(error) || this.isDeadlock(error);
      this.logger.error(
        `Failed to sync order ${orderDto.posLocalId}: ${errorMessage}`,
      );
      return {
        posLocalId: orderDto.posLocalId,
        status: 'ERROR',
        message: retriable ? `RETRYABLE: ${errorMessage}` : errorMessage,
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

      // Use the actual processing time from the POS device, not the sync time,
      // so a late-synced payment is still attributed to the day it actually occurred.
      const processedAt = this.resolveTimestamp(
        paymentDto.processedAt,
        paymentDto.posLocalId,
        'payment',
      );

      // Generate payment number. Retry when two payments draw the same number.
      let savedPayment: PaymentEntity | undefined;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const paymentNumber = this.generatePaymentNumber();
        const payment = this.paymentRepository.create({
          paymentNumber,
          posLocalId: paymentDto.posLocalId,
          orderId,
          terminalId: terminal.id,
          organizationId: user?.organizationId,
          method: paymentDto.method,
          amount: this.toMoney(paymentDto.amount),
          status: PaymentStatus.COMPLETED,
          reference: paymentDto.reference,
          processedAt,
          syncedAt: new Date(),
        });

        try {
          savedPayment = await this.paymentRepository.save(payment);
          break;
        } catch (error) {
          if (this.isPosLocalIdConflict(error)) {
            const raced = await this.paymentRepository.findOne({
              where: { posLocalId: paymentDto.posLocalId },
            });
            if (raced) {
              this.logger.log(`Payment already synced: ${paymentDto.posLocalId}`);
              return {
                posLocalId: paymentDto.posLocalId,
                status: 'DUPLICATE',
                serverId: raced.id,
                message: 'Payment already exists',
              };
            }
          }
          if (attempt === 3 || !this.isUniqueViolation(error)) {
            throw error;
          }
          this.logger.warn(
            `Retrying payment ${paymentDto.posLocalId} after payment number collision (attempt ${attempt})`,
          );
        }
      }

      if (!savedPayment) {
        throw new Error(`Failed to save payment ${paymentDto.posLocalId}`);
      }

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
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.deletedAt IS NULL');

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
        packMarkupPercentage: p.packMarkupPercentage ? Number(p.packMarkupPercentage) : undefined,
        packMarkupFixed: p.packMarkupFixed ? Number(p.packMarkupFixed) : undefined,
        halfPackPrice: p.halfPackPrice ? Number(p.halfPackPrice) : undefined,
        halfPackQuantity: p.halfPackQuantity ?? undefined,
        halfPackMarkupPercentage: p.halfPackMarkupPercentage ? Number(p.halfPackMarkupPercentage) : undefined,
        halfPackMarkupFixed: p.halfPackMarkupFixed ? Number(p.halfPackMarkupFixed) : undefined,
        addonPrice: p.addonPrice ? Number(p.addonPrice) : undefined,
        convenienceMarkupPercentage: p.convenienceMarkupPercentage ? Number(p.convenienceMarkupPercentage) : undefined,
        convenienceMarkup: p.convenienceMarkup ? Number(p.convenienceMarkup) : undefined,
        taxRate: Number(p.taxRate),
        barcode: p.barcode,
        imageUrl: p.imageUrl,
        status: p.status,
        stockQuantity: p.stockQuantity,
        infiniteStock: p.infiniteStock === true,
      })),
      lastUpdated: new Date(),
    };
  }

  private generateOrderNumber(): string {
    return `ORD-${this.uniqueSuffix()}`;
  }

  private generatePaymentNumber(): string {
    return `PAY-${this.uniqueSuffix()}`;
  }

  /**
   * Millisecond timestamp plus 6 base36 characters (~2e9 values).
   * The previous generator used only 1,000 random values per millisecond and
   * a unique constraint, so parallel sync (5 orders at a time, or several
   * terminals) collided about once every few hundred orders. The failed order
   * stayed in error until a later attempt happened to draw a free number.
   */
  private uniqueSuffix(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 36 ** 6)
      .toString(36)
      .toUpperCase()
      .padStart(6, '0');
    return `${time}${rand}`;
  }

  private toMoney(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100) / 100;
  }

  /** order_items.taxRate is numeric(5,4), so values must be below 10. */
  private toTaxRate(value: unknown): number {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0) return 0;
    return Math.min(9.9999, Math.round(rate * 10000) / 10000);
  }

  private driverError(error: unknown): { code?: string; constraint?: string; detail?: string; message?: string } {
    const driver = (error as { driverError?: { code?: string; constraint?: string; detail?: string; message?: string } })?.driverError;
    return driver ?? {};
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.driverError(error).code === '23505';
  }

  private isPosLocalIdConflict(error: unknown): boolean {
    if (!this.isUniqueViolation(error)) return false;
    const driver = this.driverError(error);
    const text = `${driver.constraint ?? ''} ${driver.detail ?? ''} ${driver.message ?? ''} ${error instanceof Error ? error.message : ''}`;
    return /posLocalId/i.test(text) || /pos_local_id/i.test(text);
  }

  private isDeadlock(error: unknown): boolean {
    return this.driverError(error).code === '40P01';
  }

  /**
   * Parses a client-supplied timestamp (arrives as an ISO string over JSON)
   * into a Date, falling back to "now" and logging a warning if it's missing
   * or invalid. This is what anchors an order/payment to the day and time it
   * actually happened on the POS, independent of when the sync request lands
   * on the server — critical for offline devices that retry a failed sync
   * hours or days later.
   */
  private resolveTimestamp(
    value: Date | string | undefined,
    posLocalId: string,
    entityLabel: string,
  ): Date {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      this.logger.warn(
        `Invalid timestamp received for ${entityLabel} ${posLocalId}: ${value}. Falling back to server time.`,
      );
    } else {
      this.logger.warn(
        `Missing timestamp for ${entityLabel} ${posLocalId}. Falling back to server time.`,
      );
    }
    return new Date();
  }

  private isUUID(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Locate the original sale for an exchange. The POS historically stored
   * its local display orderNumber as exchangeRef, but the server generates a
   * new orderNumber on sync — so lookup by orderNumber alone misses. Prefer
   * the stable posLocalId (and server UUID) instead.
   */
  private async findOriginalExchangeOrder(
    queryRunner: QueryRunner,
    exchangeRef?: string,
    originalPosLocalId?: string,
    organizationId?: string,
  ): Promise<OrderEntity | null> {
    const conditions: FindOptionsWhere<OrderEntity>[] = [];

    if (originalPosLocalId) {
      conditions.push({ posLocalId: originalPosLocalId });
    }

    if (exchangeRef) {
      conditions.push({ posLocalId: exchangeRef });
      conditions.push({ orderNumber: exchangeRef });
      if (this.isUUID(exchangeRef)) {
        conditions.push({ id: exchangeRef });
      }
    }

    if (conditions.length === 0) {
      return null;
    }

    const where = organizationId
      ? conditions.map((c) => ({ ...c, organizationId }))
      : conditions;

    return queryRunner.manager.findOne(OrderEntity, { where });
  }

  private async restoreReturnedStock(
    queryRunner: QueryRunner,
    returnedItems: {
      productId: string;
      quantity: number;
      name?: string;
    }[],
    contextLabel: string,
  ): Promise<number> {
    let restoredCount = 0;

    for (const returnedItem of returnedItems) {
      if (
        !returnedItem.productId ||
        returnedItem.productId.startsWith('manual-')
      ) {
        continue;
      }

      const quantity = Math.max(0, Math.round(Number(returnedItem.quantity) || 0));
      if (!quantity || quantity <= 0) {
        continue;
      }

      const returnedProduct = await queryRunner.manager.findOne(ProductEntity, {
        where: { id: returnedItem.productId },
      });

      if (returnedProduct?.infiniteStock) {
        this.logger.log(
          `Skipping stock restoration for unlimited stock product: ${returnedItem.name || returnedProduct.name}`,
        );
      } else if (returnedProduct) {
        await queryRunner.manager.increment(
          ProductEntity,
          { id: returnedItem.productId },
          'stockQuantity',
          quantity,
        );
        this.logger.log(
          `Restored ${quantity} units of ${returnedItem.name || returnedProduct.name} (${returnedItem.productId}) ${contextLabel}`,
        );
        restoredCount++;
      } else {
        this.logger.warn(
          `Product not found for exchange stock restoration: ${returnedItem.productId}`,
        );
      }
    }

    return restoredCount;
  }
}
