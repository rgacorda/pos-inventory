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
    // Snapshot the items as they were before this update, since stock was
    // already applied based on this exact list (if the delivery was
    // RECEIVED). We need it to compute what changed.
    const oldItems = delivery.items || [];

    await this.resolveSupplierLink(updateDto, organizationId);

    Object.assign(delivery, updateDto);
    const updatedDelivery = (await this.deliveryRepository.save(
      delivery,
    )) as unknown as InventoryDelivery;

    const wasReceived = oldStatus === 'RECEIVED';
    const isReceived = updatedDelivery.status === 'RECEIVED';
    const newItems = updatedDelivery.items || [];

    if (wasReceived && isReceived) {
      // Delivery was already RECEIVED and still is: only the difference
      // between the old and new item quantities should move stock, so
      // adding, removing, or changing the quantity of an item correctly
      // increases/decreases the product's stock instead of double-applying
      // or ignoring the change.
      await this.reconcileProductStock(
        oldItems,
        newItems,
        updatedDelivery.organizationId,
        updatedDelivery.supplierId,
      );
    } else if (!wasReceived && isReceived) {
      // Transitioning into RECEIVED: nothing was applied to stock before,
      // so apply the full current item list now.
      if (newItems.length > 0) {
        await this.updateProductStock(
          newItems,
          updatedDelivery.organizationId,
          updatedDelivery.supplierId,
        );
      }
    } else if (wasReceived && !isReceived) {
      // Transitioning out of RECEIVED (e.g. cancelled): reverse whatever
      // stock was previously added for the old items.
      if (oldItems.length > 0) {
        await this.reverseProductStock(oldItems, updatedDelivery.organizationId);
      }
    }
    // If it was never RECEIVED and still isn't, items may have changed but
    // stock was never touched for them, so there's nothing to reconcile.

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

        this.applyCostSync(product, item);

        await this.productRepository.save(product);
      }
    }
  }

  /**
   * Reconciles product stock between an old and new set of delivery items,
   * applying only the net quantity difference per product (positive when
   * items/quantities were added, negative when removed or decreased), so
   * editing an already-RECEIVED delivery's items keeps stock accurate
   * instead of only ever adding.
   */
  private async reconcileProductStock(
    oldItems: Array<{ productId: string; quantity: number }>,
    newItems: Array<{
      productId: string;
      quantity: number;
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
    }>,
    organizationId: string,
    supplierId?: string | null,
  ) {
    const oldQuantityByProduct = this.sumQuantitiesByProduct(oldItems);
    const newQuantityByProduct = this.sumQuantitiesByProduct(newItems);
    const productIds = new Set([
      ...oldQuantityByProduct.keys(),
      ...newQuantityByProduct.keys(),
    ]);

    for (const productId of productIds) {
      const oldQuantity = oldQuantityByProduct.get(productId) || 0;
      const newQuantity = newQuantityByProduct.get(productId) || 0;
      const delta = newQuantity - oldQuantity;

      const product = await this.productRepository.findOne({
        where: { id: productId, organizationId },
      });
      if (!product) continue;

      if (delta !== 0) {
        product.stockQuantity += delta;
      }
      if (supplierId) {
        product.supplierId = supplierId;
      }

      // Sync cost from whichever current item(s) for this product request
      // it, regardless of whether the quantity itself changed.
      for (const item of newItems) {
        if (item.productId === productId) {
          this.applyCostSync(product, item);
        }
      }

      await this.productRepository.save(product);
    }
  }

  /** Reverses stock previously added for a set of items (e.g. a RECEIVED delivery was cancelled or deleted). */
  private async reverseProductStock(
    items: Array<{ productId: string; quantity: number }>,
    organizationId: string,
  ) {
    const quantityByProduct = this.sumQuantitiesByProduct(items);
    for (const [productId, quantity] of quantityByProduct) {
      const product = await this.productRepository.findOne({
        where: { id: productId, organizationId },
      });
      if (product) {
        product.stockQuantity -= quantity;
        await this.productRepository.save(product);
      }
    }
  }

  private sumQuantitiesByProduct(
    items: Array<{ productId: string; quantity: number }> = [],
  ) {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
    }
    return map;
  }

  /**
   * Keeps the product's cost (and price, if markups are set) in sync with
   * the latest delivery price. Always the case when the item was bought by
   * pack/half-pack (the per-unit cost is derived from packPrice ÷
   * packQuantity), or when explicitly requested for individually-priced
   * items. Free items never touch cost since they carry no real purchase
   * price.
   */
  private applyCostSync(
    product: ProductEntity,
    item: { unitCost?: number; isFree?: boolean; updateProductCost?: boolean },
  ) {
    if (item.updateProductCost && !item.isFree && item.unitCost != null) {
      product.cost = item.unitCost;
      const percentNum = Number(product.markupPercentage) || 0;
      const fixedNum = Number(product.markupFixed) || 0;
      if (percentNum || fixedNum) {
        product.price =
          item.unitCost + (item.unitCost * percentNum) / 100 + fixedNum;
      }
    }
  }

  async delete(id: string, organizationId: string) {
    const delivery = await this.findOne(id, organizationId);

    // Deleting a delivery that already added stock should reverse it,
    // otherwise the stock it contributed would be left behind permanently.
    if (delivery.status === 'RECEIVED' && delivery.items?.length > 0) {
      await this.reverseProductStock(delivery.items, organizationId);
    }

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
