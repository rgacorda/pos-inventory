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
    private dataSource: DataSource,
  ) {}

  async processSync(syncRequest: SyncRequestDto): Promise<SyncResponseDto> {
    this.logger.log(
      `Processing sync for terminal: ${syncRequest.terminalId}`,
    );

    const syncedAt = new Date();
    const orderResults: SyncResultDto[] = [];
    const paymentResults: SyncResultDto[] = [];

    // Process orders
    for (const orderDto of syncRequest.orders) {
      const result = await this.processOrder(orderDto);
      orderResults.push(result);
    }

    // Process payments
    for (const paymentDto of syncRequest.payments) {
      const result = await this.processPayment(paymentDto);
      paymentResults.push(result);
    }

    // Update terminal last sync time
    await this.updateTerminalSync(syncRequest.terminalId, syncedAt);

    // Get product catalog if requested or if it's been a while
    const catalog = await this.getProductCatalog(syncRequest.lastSyncAt);

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
        // Generate order number
        const orderNumber = await this.generateOrderNumber();

        // Create order entity
        const order = this.orderRepository.create({
          orderNumber,
          posLocalId: orderDto.posLocalId,
          terminalId: orderDto.terminalId,
          cashierId: orderDto.cashierId,
          subtotal: orderDto.subtotal,
          taxAmount: orderDto.taxAmount,
          discountAmount: orderDto.discountAmount,
          totalAmount: orderDto.totalAmount,
          status: OrderStatus.SYNCED,
          completedAt: orderDto.completedAt,
          syncedAt: new Date(),
        });

        const savedOrder = await queryRunner.manager.save(order);

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
        for (const item of orderDto.items) {
          await queryRunner.manager.decrement(
            ProductEntity,
            { id: item.productId },
            'stockQuantity',
            item.quantity,
          );
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
      this.logger.error(
        `Failed to sync order ${orderDto.posLocalId}: ${error.message}`,
      );
      return {
        posLocalId: orderDto.posLocalId,
        status: 'ERROR',
        message: error.message,
      };
    }
  }

  private async processPayment(
    paymentDto: CreatePaymentDto,
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

      // Find order by server ID or posLocalId
      let orderId = paymentDto.orderId;
      if (!orderId && paymentDto.orderPosLocalId) {
        const order = await this.orderRepository.findOne({
          where: { posLocalId: paymentDto.orderPosLocalId },
        });
        if (!order) {
          throw new Error('Order not found for payment');
        }
        orderId = order.id;
      }

      if (!orderId) {
        throw new Error('Order not found for payment');
      }

      // Generate payment number
      const paymentNumber = await this.generatePaymentNumber();

      // Create payment
      const payment = this.paymentRepository.create({
        paymentNumber,
        posLocalId: paymentDto.posLocalId,
        orderId,
        terminalId: paymentDto.terminalId,
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
      this.logger.error(
        `Failed to sync payment ${paymentDto.posLocalId}: ${error.message}`,
      );
      return {
        posLocalId: paymentDto.posLocalId,
        status: 'ERROR',
        message: error.message,
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
  ): Promise<ProductCatalogDto> {
    const products = await this.productRepository.find({
      where: { status: ProductStatus.ACTIVE },
      select: [
        'id',
        'sku',
        'name',
        'description',
        'category',
        'price',
        'taxRate',
        'barcode',
        'imageUrl',
      ],
    });

    return {
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        price: Number(p.price),
        taxRate: Number(p.taxRate),
        barcode: p.barcode,
        imageUrl: p.imageUrl,
        isActive: p.status === ProductStatus.ACTIVE,
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
}
