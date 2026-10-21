import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { InventoryReturnsService } from '../inventory-returns/inventory-returns.service';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class InventoryDeliveriesService {
  constructor(
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly inventoryReturnsService: InventoryReturnsService,
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
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      archived?: boolean;
    },
    user?: { role?: string },
  ) {
    if (filters?.archived) {
      this.assertAdmin(user);
    }

    const queryBuilder = this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.organizationId = :organizationId', { organizationId })
      .andWhere(
        filters?.archived
          ? 'delivery.deletedAt IS NOT NULL'
          : 'delivery.deletedAt IS NULL',
      )
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

    const requestedResolutions = this.extractRequestedResolutions(createDto);
    const preparedResolutions =
      await this.inventoryReturnsService.prepareDeliveryResolutions(
        createDto.organizationId,
        createDto.supplierId || null,
        requestedResolutions,
      );

    this.applyReturnTotals(createDto, preparedResolutions);

    const delivery = this.deliveryRepository.create(createDto);
    const savedDelivery = (await this.deliveryRepository.save(
      delivery,
    )) as unknown as InventoryDelivery;

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

    await this.inventoryReturnsService.syncDeliveryResolutions(
      savedDelivery.organizationId,
      savedDelivery.id,
      preparedResolutions,
      savedDelivery.status === 'RECEIVED',
    );

    return savedDelivery;
  }

  async update(
    id: string,
    organizationId: string,
    updateDto: any,
    user?: {
      id?: string;
      userId?: string;
      name?: string;
      email?: string;
      role?: string;
    },
  ): Promise<InventoryDelivery> {
    const delivery = await this.findOne(id, organizationId);
    if (delivery.deletedAt) {
      throw new BadRequestException(
        'Archived deliveries cannot be edited. Restore the delivery first.',
      );
    }
    const oldStatus = delivery.status;
    // Snapshot the items as they were before this update, since stock was
    // already applied based on this exact list (if the delivery was
    // RECEIVED). We need it to compute what changed.
    const oldItems = delivery.items || [];

    await this.resolveSupplierLink(updateDto, organizationId);

    const requestedResolutions =
      'returnResolutions' in updateDto
        ? this.extractRequestedResolutions(updateDto)
        : (delivery.returnResolutions || []).map((resolution) => ({
            returnId: resolution.returnId,
            action: resolution.action,
            replacementItems: resolution.replacementItems,
          }));

    const supplierId =
      'supplierId' in updateDto
        ? updateDto.supplierId || null
        : delivery.supplierId;

    const preparedResolutions =
      await this.inventoryReturnsService.prepareDeliveryResolutions(
        organizationId,
        supplierId,
        requestedResolutions,
        delivery.id,
      );

    const itemsForTotal =
      updateDto.items !== undefined ? updateDto.items : delivery.items;
    const discountForTotal =
      updateDto.discountAmount !== undefined
        ? updateDto.discountAmount
        : delivery.discountAmount;
    this.applyReturnTotals(
      updateDto,
      preparedResolutions,
      itemsForTotal,
      discountForTotal,
    );

    // The server owns this log. A client cannot invent or erase edits.
    delete updateDto.editHistory;
    if (updateDto.items !== undefined) {
      this.recordItemEdits(delivery, oldItems, updateDto.items, user);
    }

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

    await this.inventoryReturnsService.syncDeliveryResolutions(
      organizationId,
      updatedDelivery.id,
      preparedResolutions,
      isReceived,
    );

    return updatedDelivery;
  }

  private async updateProductStock(
    items: Array<{
      productId: string;
      quantity: number;
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
      priceOverride?: number;
      packPriceOverride?: number;
      packQuantityOverride?: number;
      halfPackPriceOverride?: number;
      halfPackQuantityOverride?: number;
    }>,
    organizationId: string,
    supplierId?: string | null,
  ) {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, organizationId },
      });

      if (product) {
        if (!product.infiniteStock) {
          product.stockQuantity += item.quantity;
        }
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
      priceOverride?: number;
      packPriceOverride?: number;
      packQuantityOverride?: number;
      halfPackPriceOverride?: number;
      halfPackQuantityOverride?: number;
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

      if (delta !== 0 && !product.infiniteStock) {
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
      if (product && !product.infiniteStock) {
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
   *
   * Also applies any manual selling-price overrides entered alongside the
   * cost (unit/pack/half-pack selling price and pack/half-pack quantity),
   * gated on the same `updateProductCost`/`isFree` conditions as cost so
   * they only ever take effect once the delivery is actually RECEIVED -
   * never immediately when the item is added to the form, and never
   * partially applied if the delivery is never saved. A manual
   * `priceOverride` always takes precedence over the markup calculation.
   */
  private applyCostSync(
    product: ProductEntity,
    item: {
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
      priceOverride?: number;
      packPriceOverride?: number;
      packQuantityOverride?: number;
      halfPackPriceOverride?: number;
      halfPackQuantityOverride?: number;
    },
  ) {
    if (item.updateProductCost && !item.isFree && item.unitCost != null) {
      product.cost = item.unitCost;

      if (item.priceOverride != null && item.priceOverride > 0) {
        product.price = item.priceOverride;
      } else {
        const percentNum = Number(product.markupPercentage) || 0;
        const fixedNum = Number(product.markupFixed) || 0;
        if (percentNum || fixedNum) {
          product.price =
            item.unitCost + (item.unitCost * percentNum) / 100 + fixedNum;
        }
      }

      if (item.packQuantityOverride != null) {
        product.packQuantity = item.packQuantityOverride;
      }
      if (item.packPriceOverride != null && item.packPriceOverride > 0) {
        product.packPrice = item.packPriceOverride;
      }
      if (item.halfPackQuantityOverride != null) {
        product.halfPackQuantity = item.halfPackQuantityOverride;
      }
      if (item.halfPackPriceOverride != null && item.halfPackPriceOverride > 0) {
        product.halfPackPrice = item.halfPackPriceOverride;
      }
    }
  }

  async dismissEdits(
    id: string,
    organizationId: string,
    user?: { role?: string },
  ) {
    this.assertAdmin(user);
    const delivery = await this.findOne(id, organizationId);
    const history = delivery.editHistory || [];
    if (history.length === 0) {
      return delivery;
    }

    const latest = history.reduce(
      (max, entry) => (entry.editedAt > max ? entry.editedAt : max),
      history[0].editedAt,
    );
    delivery.editHistoryDismissedAt = new Date(new Date(latest).getTime() + 1000);
    await this.deliveryRepository.save(delivery);
    return this.findOne(id, organizationId);
  }

  async archive(
    id: string,
    organizationId: string,
    user: { id?: string; userId?: string; name?: string; email?: string },
  ) {
    const delivery = await this.findOne(id, organizationId);
    if (delivery.deletedAt) {
      throw new BadRequestException('Delivery is already archived');
    }

    delivery.deletedAt = new Date();
    delivery.deletedByUserId = user.id || user.userId || null;
    delivery.deletedByName = user.name || user.email || 'Unknown user';
    await this.deliveryRepository.save(delivery);
    return { message: 'Delivery archived' };
  }

  async restore(id: string, organizationId: string) {
    const delivery = await this.findOne(id, organizationId);
    if (!delivery.deletedAt) {
      throw new BadRequestException('Delivery is not archived');
    }

    delivery.deletedAt = null;
    delivery.deletedByUserId = null;
    delivery.deletedByName = null;
    await this.deliveryRepository.save(delivery);
    return this.findOne(id, organizationId);
  }

  async delete(id: string, organizationId: string) {
    const delivery = await this.findOne(id, organizationId);

    if (!delivery.deletedAt) {
      throw new BadRequestException(
        'Archive the delivery before permanently deleting it',
      );
    }

    // Deleting a delivery that already added stock should reverse it,
    // otherwise the stock it contributed would be left behind permanently.
    if (delivery.status === 'RECEIVED' && delivery.items?.length > 0) {
      await this.reverseProductStock(delivery.items, organizationId);
    }

    await this.inventoryReturnsService.unlinkDeliveryResolutions(
      organizationId,
      delivery.id,
    );

    await this.deliveryRepository.remove(delivery);
    return { message: 'Delivery deleted successfully' };
  }

  /**
   * Marks line items whose product has been archived so delivery views can
   * show them as deleted without dropping the historical line.
   */
  async annotateDeletedProducts(deliveries: InventoryDelivery[]) {
    const ids = new Set<string>();
    for (const delivery of deliveries) {
      for (const item of delivery.items || []) {
        if (item?.productId) ids.add(item.productId);
      }
    }
    if (ids.size === 0) return deliveries;

    const archivedRows = await this.productRepository
      .createQueryBuilder('product')
      .select('product.id')
      .where('product.id IN (:...ids)', { ids: [...ids] })
      .andWhere('product.deletedAt IS NOT NULL')
      .getMany();
    const deletedIds = new Set(archivedRows.map((product) => product.id));

    for (const delivery of deliveries) {
      delivery.items = (delivery.items || []).map((item) => ({
        ...item,
        productDeleted: deletedIds.has(item.productId),
      }));
    }
    return deliveries;
  }

  private assertAdmin(user?: { role?: string }) {
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only an admin can view archived deliveries');
    }
  }

  private recordItemEdits(
    delivery: InventoryDelivery,
    oldItems: Array<{ productId: string; productName: string; quantity: number }>,
    newItems: Array<{ productId: string; productName: string; quantity: number }>,
    user?: { id?: string; userId?: string; name?: string; email?: string },
  ) {
    const previous = this.quantitiesByProduct(oldItems);
    const next = this.quantitiesByProduct(newItems);
    const added: NonNullable<InventoryDelivery['editHistory']>[number]['added'] = [];
    const removed: NonNullable<InventoryDelivery['editHistory']>[number]['removed'] = [];
    const changed: NonNullable<InventoryDelivery['editHistory']>[number]['changed'] = [];

    for (const [productId, item] of next) {
      const before = previous.get(productId);
      if (!before) {
        added.push(item);
      } else if (before.quantity !== item.quantity) {
        changed.push({
          productId,
          productName: item.productName || before.productName,
          previousQuantity: before.quantity,
          quantity: item.quantity,
        });
      }
    }

    for (const [productId, item] of previous) {
      if (!next.has(productId)) {
        removed.push({ productId, productName: item.productName, quantity: item.quantity });
      }
    }

    if (added.length === 0 && removed.length === 0 && changed.length === 0) {
      return;
    }

    delivery.editHistory = [
      ...(delivery.editHistory || []),
      {
        editedAt: new Date().toISOString(),
        editedByUserId: user?.id || user?.userId || null,
        editedByName: user?.name || user?.email || 'Unknown user',
        added,
        removed,
        changed,
      },
    ];
  }

  private quantitiesByProduct(
    items: Array<{ productId: string; productName: string; quantity: number }>,
  ) {
    const totals = new Map<string, { productId: string; productName: string; quantity: number }>();
    for (const item of items || []) {
      if (!item?.productId) continue;
      const quantity = Number(item.quantity) || 0;
      const current = totals.get(item.productId);
      if (current) {
        current.quantity += quantity;
        if (item.productName) current.productName = item.productName;
      } else {
        totals.set(item.productId, {
          productId: item.productId,
          productName: item.productName || 'Unknown product',
          quantity,
        });
      }
    }
    return totals;
  }

  private extractRequestedResolutions(
    dto: Record<string, any>,
  ): Array<{
    returnId: string;
    action: string;
    replacementItems?: Array<{
      productId: string;
      productName: string;
      productSku?: string;
      quantity: number;
      unitCost: number;
      totalCost?: number;
    }>;
  }> {
    const raw = Array.isArray(dto.returnResolutions)
      ? dto.returnResolutions
      : [];
    return raw.map(
      (item: {
        returnId?: string;
        action?: string;
        replacementItems?: Array<{
          productId: string;
          productName: string;
          productSku?: string;
          quantity: number;
          unitCost: number;
          totalCost?: number;
        }>;
      }) => ({
        returnId: item?.returnId || '',
        action: item?.action || '',
        replacementItems: item?.replacementItems,
      }),
    );
  }

  /**
   * Recomputes `returnCreditAmount` and `totalCost` from the items,
   * discount, and credited returns so a client cannot under/overstate
   * what was actually paid.
   */
  private applyReturnTotals(
    dto: Record<string, any>,
    resolutions: Array<{
      returnId: string;
      action: 'FULFILL' | 'CREDIT';
      amount: number;
      replacementItems?: Array<{
        productId: string;
        productName: string;
        productSku?: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }>;
    }>,
    itemsOverride?: Array<{ totalCost?: number }>,
    discountOverride?: number,
  ) {
    const items = itemsOverride ?? dto.items ?? [];
    const itemsSubtotal = (items || []).reduce(
      (sum: number, item: { totalCost?: number }) =>
        sum + Number(item?.totalCost || 0),
      0,
    );
    const discount = Number(
      discountOverride !== undefined ? discountOverride : dto.discountAmount || 0,
    );
    const returnCreditAmount = resolutions
      .filter((resolution) => resolution.action === 'CREDIT')
      .reduce((sum, resolution) => sum + Number(resolution.amount || 0), 0);

    dto.returnResolutions = resolutions;
    dto.returnCreditAmount = Math.round(returnCreditAmount * 100) / 100;
    dto.totalCost =
      Math.round(
        Math.max(itemsSubtotal - discount - dto.returnCreditAmount, 0) * 100,
      ) / 100;
  }

  async getStats(
    organizationId: string,
    filters?: { startDate?: string; endDate?: string },
  ) {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.organizationId = :organizationId', { organizationId })
      .andWhere('delivery.deletedAt IS NULL');

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
