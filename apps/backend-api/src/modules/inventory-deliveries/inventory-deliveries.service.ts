import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { InventoryReturn } from '../../entities/inventory-return.entity';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { InventoryReturnsService } from '../inventory-returns/inventory-returns.service';
import { UserRole } from '@pos/shared-types';
import {
  applyMarkup,
  belowCostPricingMessage,
  roundMoney,
} from '@pos/shared-utils';
import {
  adjustTrackedStock,
  sumStockByProduct,
} from '../../common/stock-quantity';

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

  async create(
    createDto: any,
    user?: { id?: string; userId?: string; name?: string; email?: string },
  ): Promise<InventoryDelivery> {
    delete createDto.createdByUserId;
    delete createDto.createdByName;
    createDto.createdByUserId = user?.id || user?.userId || null;
    createDto.createdByName = user?.name || user?.email || null;

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
    return this.deliveryRepository.manager.transaction(async (manager) => {
      const savedDelivery = (await manager.save(
        delivery,
      )) as unknown as InventoryDelivery;

      await this.lockProductsInOrder(manager, savedDelivery.organizationId, [
        ...(savedDelivery.items || []).map((item) => item.productId),
        ...this.resolutionProductIds(preparedResolutions),
      ]);

      if (savedDelivery.status === 'RECEIVED') {
        await this.applyStockChange(
          manager,
          [],
          savedDelivery.items || [],
          savedDelivery.organizationId,
          savedDelivery.supplierId,
        );
      }

      await this.inventoryReturnsService.syncDeliveryResolutions(
        savedDelivery.organizationId,
        savedDelivery.id,
        preparedResolutions,
        savedDelivery.status === 'RECEIVED',
        manager,
      );

      return savedDelivery;
    });
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

    // The server owns this log and the creator. A client cannot invent,
    // erase, or reassign either.
    delete updateDto.editHistory;
    delete updateDto.createdByUserId;
    delete updateDto.createdByName;
    if (updateDto.items !== undefined) {
      this.recordItemEdits(delivery, oldItems, updateDto.items, user);
    }

    Object.assign(delivery, updateDto);

    return this.deliveryRepository.manager.transaction(async (manager) => {
      const updatedDelivery = (await manager.save(
        delivery,
      )) as unknown as InventoryDelivery;

      const linkedReturns = await manager.find(InventoryReturn, {
        where: { organizationId, resolvedDeliveryId: updatedDelivery.id },
      });
      await this.lockProductsInOrder(manager, organizationId, [
        ...oldItems.map((item) => item.productId),
        ...(updatedDelivery.items || []).map((item) => item.productId),
        ...this.resolutionProductIds(preparedResolutions),
        ...linkedReturns.flatMap((record) =>
          (record.replacementItems || []).map((item) => item.productId),
        ),
      ]);

      const wasReceived = oldStatus === 'RECEIVED';
      const isReceived = updatedDelivery.status === 'RECEIVED';
      const newItems = updatedDelivery.items || [];

      if (wasReceived && isReceived) {
        // Already received: move stock by the quantity difference only.
        await this.applyStockChange(
          manager,
          oldItems,
          newItems,
          updatedDelivery.organizationId,
          updatedDelivery.supplierId,
        );
      } else if (!wasReceived && isReceived) {
        await this.applyStockChange(
          manager,
          [],
          newItems,
          updatedDelivery.organizationId,
          updatedDelivery.supplierId,
        );
      } else if (wasReceived && !isReceived) {
        await this.applyStockChange(
          manager,
          oldItems,
          [],
          updatedDelivery.organizationId,
          null,
        );
      }

      await this.inventoryReturnsService.syncDeliveryResolutions(
        organizationId,
        updatedDelivery.id,
        preparedResolutions,
        isReceived,
        manager,
      );

      return updatedDelivery;
    });
  }

  /**
   * Locks every product this delivery will touch, in id order, before any
   * stock update. Sales lock in the same order, so the two cannot deadlock.
   */
  private async lockProductsInOrder(
    manager: EntityManager,
    organizationId: string,
    productIds: Array<string | null | undefined>,
  ) {
    const ids = [...new Set(productIds.filter((id): id is string => !!id))].sort();
    for (const id of ids) {
      await manager.findOne(ProductEntity, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
    }
  }

  private resolutionProductIds(
    resolutions: Array<{ replacementItems?: Array<{ productId?: string }> }>,
  ) {
    return resolutions.flatMap((resolution) =>
      (resolution.replacementItems || []).map((item) => item.productId),
    );
  }

  /**
   * Moves stock by the net unit difference and updates cost/supplier
   * without writing stockQuantity from a previously loaded row. Product
   * ids are sorted so this cannot deadlock with a sale, which locks in
   * the same order.
   */
  private async applyStockChange(
    manager: EntityManager,
    oldItems: Array<{ productId: string; quantity: number }>,
    newItems: Array<{
      productId: string;
      quantity: number;
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
      priceOverride?: number;
      packPriceOverride?: number | null;
      packQuantityOverride?: number | null;
      halfPackPriceOverride?: number | null;
      halfPackQuantityOverride?: number | null;
      markupPercentage?: number | null;
      markupFixed?: number | null;
      packMarkupPercentage?: number | null;
      packMarkupFixed?: number | null;
      halfPackMarkupPercentage?: number | null;
      halfPackMarkupFixed?: number | null;
    }>,
    organizationId: string,
    supplierId?: string | null,
  ) {
    const oldTotals = sumStockByProduct(oldItems);
    const newTotals = sumStockByProduct(newItems);
    const deltas = new Map<string, number>();
    for (const productId of new Set([...oldTotals.keys(), ...newTotals.keys()])) {
      const delta = (newTotals.get(productId) || 0) - (oldTotals.get(productId) || 0);
      if (delta !== 0) deltas.set(productId, delta);
    }

    const pricingIds = new Set<string>();
    for (const item of newItems || []) {
      if (!item?.productId) continue;
      if (supplierId) pricingIds.add(item.productId);
      if (item.updateProductCost && !item.isFree && item.unitCost != null) {
        pricingIds.add(item.productId);
      }
    }

    const productIds = [...new Set([...deltas.keys(), ...pricingIds])].sort();
    for (const productId of productIds) {
      const delta = deltas.get(productId) || 0;
      if (delta !== 0) {
        await adjustTrackedStock(manager, productId, delta, organizationId);
      }
      if (pricingIds.has(productId)) {
        await this.syncPricing(
          manager,
          organizationId,
          productId,
          supplierId,
          newItems,
        );
      }
    }
  }

  /**
   * Writes cost, price, and supplier only. stockQuantity is left to
   * adjustTrackedStock so a sale during this delivery is not overwritten.
   */
  private async syncPricing(
    manager: EntityManager,
    organizationId: string,
    productId: string,
    supplierId: string | null | undefined,
    items: Array<{
      productId: string;
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
      priceOverride?: number;
      packPriceOverride?: number | null;
      packQuantityOverride?: number | null;
      halfPackPriceOverride?: number | null;
      halfPackQuantityOverride?: number | null;
      markupPercentage?: number | null;
      markupFixed?: number | null;
      packMarkupPercentage?: number | null;
      packMarkupFixed?: number | null;
      halfPackMarkupPercentage?: number | null;
      halfPackMarkupFixed?: number | null;
    }>,
  ) {
    const product = await manager.findOne(ProductEntity, {
      where: { id: productId, organizationId },
    });
    if (!product) return;

    const patch: Partial<ProductEntity> = {};
    if (supplierId) patch.supplierId = supplierId;

    let costTouched = false;
    for (const item of items) {
      if (item.productId !== productId) continue;
      if (item.updateProductCost && !item.isFree && item.unitCost != null) {
        this.applyCostSync(product, item);
        costTouched = true;
      }
    }

    if (costTouched) {
      patch.cost = product.cost;
      patch.price = product.price;
      patch.markupPercentage = product.markupPercentage;
      patch.markupFixed = product.markupFixed;
      patch.packQuantity = product.packQuantity;
      patch.packPrice = product.packPrice;
      patch.packMarkupPercentage = product.packMarkupPercentage;
      patch.packMarkupFixed = product.packMarkupFixed;
      patch.halfPackQuantity = product.halfPackQuantity;
      patch.halfPackPrice = product.halfPackPrice;
      patch.halfPackMarkupPercentage = product.halfPackMarkupPercentage;
      patch.halfPackMarkupFixed = product.halfPackMarkupFixed;
    }

    if (Object.keys(patch).length === 0) return;
    await manager.update(ProductEntity, { id: productId, organizationId }, patch);
  }

  /**
   * Keeps the product's cost and selling prices in sync with the delivery.
   * Free items never touch cost. Prices are applied only once the delivery
   * is RECEIVED, together with the cost, so nothing is left half-applied
   * if the delivery is never saved.
   *
   * A sell price sent on the line is what the form showed. Markup fields
   * are saved too, so the next cost change can recalculate from the same
   * percent or fixed amount. Null clears a pack, half-pack, or markup.
   */
  private applyCostSync(
    product: ProductEntity,
    item: {
      unitCost?: number;
      isFree?: boolean;
      updateProductCost?: boolean;
      priceOverride?: number;
      packPriceOverride?: number | null;
      packQuantityOverride?: number | null;
      halfPackPriceOverride?: number | null;
      halfPackQuantityOverride?: number | null;
      markupPercentage?: number | null;
      markupFixed?: number | null;
      packMarkupPercentage?: number | null;
      packMarkupFixed?: number | null;
      halfPackMarkupPercentage?: number | null;
      halfPackMarkupFixed?: number | null;
    },
  ) {
    if (!(item.updateProductCost && !item.isFree && item.unitCost != null)) {
      return;
    }

    product.cost = roundMoney(Number(item.unitCost));
    this.writeNullable(product, 'markupPercentage', item.markupPercentage);
    this.writeNullable(product, 'markupFixed', item.markupFixed);
    this.writeNullable(product, 'packMarkupPercentage', item.packMarkupPercentage);
    this.writeNullable(product, 'packMarkupFixed', item.packMarkupFixed);
    this.writeNullable(
      product,
      'halfPackMarkupPercentage',
      item.halfPackMarkupPercentage,
    );
    this.writeNullable(product, 'halfPackMarkupFixed', item.halfPackMarkupFixed);

    if (item.packQuantityOverride !== undefined) {
      product.packQuantity = item.packQuantityOverride as any;
    }
    if (item.halfPackQuantityOverride !== undefined) {
      product.halfPackQuantity = item.halfPackQuantityOverride as any;
    }

    if (item.priceOverride != null && Number(item.priceOverride) > 0) {
      product.price = roundMoney(Number(item.priceOverride));
    } else if (Number(product.markupPercentage) || Number(product.markupFixed)) {
      product.price = applyMarkup(
        Number(product.cost),
        product.markupPercentage,
        product.markupFixed,
      );
    }

    if (item.packPriceOverride !== undefined) {
      product.packPrice = (
        item.packPriceOverride != null && Number(item.packPriceOverride) > 0
          ? roundMoney(Number(item.packPriceOverride))
          : null
      ) as any;
    } else if (
      Number(product.packQuantity) > 0 &&
      (Number(product.packMarkupPercentage) || Number(product.packMarkupFixed))
    ) {
      const computed = applyMarkup(
        Number(product.cost) * Number(product.packQuantity),
        product.packMarkupPercentage,
        product.packMarkupFixed,
      );
      product.packPrice = (computed > 0 ? computed : null) as any;
    }

    if (item.halfPackPriceOverride !== undefined) {
      product.halfPackPrice = (
        item.halfPackPriceOverride != null && Number(item.halfPackPriceOverride) > 0
          ? roundMoney(Number(item.halfPackPriceOverride))
          : null
      ) as any;
    } else if (
      Number(product.halfPackQuantity) > 0 &&
      (Number(product.halfPackMarkupPercentage) ||
        Number(product.halfPackMarkupFixed))
    ) {
      const computed = applyMarkup(
        Number(product.cost) * Number(product.halfPackQuantity),
        product.halfPackMarkupPercentage,
        product.halfPackMarkupFixed,
      );
      product.halfPackPrice = (computed > 0 ? computed : null) as any;
    }

    if (this.itemSetsSellingPrices(item)) {
      const message = belowCostPricingMessage(
        {
          cost: String(product.cost ?? ''),
          price: product.price == null ? '' : String(product.price),
          markupPercentage: '',
          markupFixed: '',
          packQuantity: product.packQuantity ? String(product.packQuantity) : '',
          packMarkupPercentage: '',
          packMarkupFixed: '',
          packPrice:
            product.packPrice != null && Number(product.packPrice) > 0
              ? String(product.packPrice)
              : '',
          halfPackQuantity: product.halfPackQuantity
            ? String(product.halfPackQuantity)
            : '',
          halfPackMarkupPercentage: '',
          halfPackMarkupFixed: '',
          halfPackPrice:
            product.halfPackPrice != null && Number(product.halfPackPrice) > 0
              ? String(product.halfPackPrice)
              : '',
        },
        Number(product.cost) || 0,
      );
      if (message) {
        throw new BadRequestException(message);
      }
    }
  }

  private writeNullable(
    product: ProductEntity,
    key:
      | 'markupPercentage'
      | 'markupFixed'
      | 'packMarkupPercentage'
      | 'packMarkupFixed'
      | 'halfPackMarkupPercentage'
      | 'halfPackMarkupFixed',
    value: number | null | undefined,
  ) {
    if (value === undefined) return;
    product[key] = value as any;
  }

  private itemSetsSellingPrices(item: {
    priceOverride?: number;
    packPriceOverride?: number | null;
    halfPackPriceOverride?: number | null;
    markupPercentage?: number | null;
    packMarkupPercentage?: number | null;
    halfPackMarkupPercentage?: number | null;
  }) {
    return (
      item.priceOverride !== undefined ||
      item.packPriceOverride !== undefined ||
      item.halfPackPriceOverride !== undefined ||
      item.markupPercentage !== undefined ||
      item.packMarkupPercentage !== undefined ||
      item.halfPackMarkupPercentage !== undefined
    );
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

    await this.deliveryRepository.manager.transaction(async (manager) => {
      const linkedReturns = await manager.find(InventoryReturn, {
        where: { organizationId, resolvedDeliveryId: delivery.id },
      });
      await this.lockProductsInOrder(manager, organizationId, [
        ...(delivery.items || []).map((item) => item.productId),
        ...linkedReturns.flatMap((record) =>
          (record.replacementItems || []).map((item) => item.productId),
        ),
      ]);

      // Deleting a delivery that already added stock should reverse it,
      // otherwise the stock it contributed would be left behind permanently.
      if (delivery.status === 'RECEIVED' && delivery.items?.length > 0) {
        await this.applyStockChange(
          manager,
          delivery.items,
          [],
          organizationId,
          null,
        );
      }

      await this.inventoryReturnsService.unlinkDeliveryResolutions(
        organizationId,
        delivery.id,
        manager,
      );

      await manager.remove(delivery);
    });
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
