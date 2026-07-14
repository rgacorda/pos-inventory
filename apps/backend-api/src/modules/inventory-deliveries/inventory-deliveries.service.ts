import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';

@Injectable()
export class InventoryDeliveriesService {
  constructor(
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  /**
   * If a `supplierId` is provided, resolve it against the suppliers table
   * (scoped to the organization) and overwrite the legacy `supplier` text
   * field with the canonical name, so old free-text search/display code
   * keeps working. If `supplierId` is explicitly cleared (null/""), the
   * link is removed but any manually entered `supplier` text is preserved
   * for backward compatibility with pre-existing free-text deliveries.
   */
  private async resolveSupplierLink(
    dto: Record<string, any>,
    organizationId: string,
  ) {
    if (!('supplierId' in dto)) {
      return;
    }

    if (!dto.supplierId) {
      dto.supplierId = null;
      return;
    }

    const supplier = await this.supplierRepository.findOne({
      where: { id: dto.supplierId, organizationId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    dto.supplierId = supplier.id;
    dto.supplier = supplier.name;
  }

  async findAll(
    organizationId: string,
    filters?: { startDate?: string; endDate?: string; status?: string },
  ) {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.organizationId = :organizationId', { organizationId })
      .orderBy('delivery.deliveryDate', 'DESC');

    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere(
        'delivery.deliveryDate BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    if (filters?.status) {
      queryBuilder.andWhere('delivery.status = :status', {
        status: filters.status,
      });
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string, organizationId: string) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id, organizationId },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    return delivery;
  }

  async create(createDto: any): Promise<InventoryDelivery> {
    await this.resolveSupplierLink(createDto, createDto.organizationId);

    const delivery = this.deliveryRepository.create(createDto);
    const savedDelivery = (await this.deliveryRepository.save(
      delivery,
    )) as unknown as InventoryDelivery;

    // Update product stock if status is RECEIVED and items exist
    if (
      savedDelivery.status === 'RECEIVED' &&
      savedDelivery.items?.length > 0
    ) {
      await this.updateProductStock(
        savedDelivery.items,
        savedDelivery.organizationId,
        savedDelivery.supplierId,
      );
    }

    return savedDelivery;
  }

  async update(
    id: string,
    organizationId: string,
    updateDto: any,
  ): Promise<InventoryDelivery> {
    const delivery = await this.findOne(id, organizationId);
    const oldStatus = delivery.status;

    await this.resolveSupplierLink(updateDto, organizationId);

    Object.assign(delivery, updateDto);
    const updatedDelivery = (await this.deliveryRepository.save(
      delivery,
    )) as unknown as InventoryDelivery;

    // Update product stock if status changed to RECEIVED and items exist
    if (
      oldStatus !== 'RECEIVED' &&
      updatedDelivery.status === 'RECEIVED' &&
      updatedDelivery.items?.length > 0
    ) {
      await this.updateProductStock(
        updatedDelivery.items,
        updatedDelivery.organizationId,
        updatedDelivery.supplierId,
      );
    }

    return updatedDelivery;
  }

  private async updateProductStock(
    items: Array<{
      productId: string;
      quantity: number;
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
    }>,
    organizationId: string,
    supplierId?: string | null,
  ) {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, organizationId },
      });

      if (product) {
        product.stockQuantity += item.quantity;
        // Tag the product with its most recent supplier so it can be
        // filtered by supplier later on.
        if (supplierId) {
          product.supplierId = supplierId;
        }

        // Keep the product's cost in sync with the latest delivery price.
        // Always the case when the item was bought by pack/half-pack (the
        // per-unit cost is derived from packPrice ÷ packQuantity), or when
        // explicitly requested for individually-priced items. Free items
        // never touch cost since they carry no real purchase price.
        if (item.updateProductCost && !item.isFree && item.unitCost != null) {
          product.cost = item.unitCost;
          const percentNum = Number(product.markupPercentage) || 0;
          const fixedNum = Number(product.markupFixed) || 0;
          if (percentNum || fixedNum) {
            product.price =
              item.unitCost + (item.unitCost * percentNum) / 100 + fixedNum;
          }
        }

        await this.productRepository.save(product);
      }
    }
  }

  async delete(id: string, organizationId: string) {
    const delivery = await this.findOne(id, organizationId);
    await this.deliveryRepository.remove(delivery);
    return { message: 'Delivery deleted successfully' };
  }

  async getStats(
    organizationId: string,
    filters?: { startDate?: string; endDate?: string },
  ) {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.organizationId = :organizationId', { organizationId });

    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere(
        'delivery.deliveryDate BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    const deliveries = await queryBuilder.getMany();

    const receivedOnly = deliveries.filter((d) => d.status === 'RECEIVED');

    const totalCost = receivedOnly.reduce(
      (sum, d) => sum + Number(d.totalCost),
      0,
    );
    const totalDiscount = receivedOnly.reduce(
      (sum, d) => sum + Number(d.discountAmount || 0),
      0,
    );

    const totalDeliveries = deliveries.length;
    const receivedDeliveries = receivedOnly.length;
    const pendingDeliveries = deliveries.filter(
      (d) => d.status === 'PENDING',
    ).length;

    return {
      totalCost,
      totalDiscount,
      totalDeliveries,
      receivedDeliveries,
      pendingDeliveries,
    };
  }
}
