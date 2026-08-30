import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InventoryReturn,
  InventoryReturnItem,
} from '../../entities/inventory-return.entity';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import {
  CreateInventoryReturnDto,
  UpdateInventoryReturnDto,
  ResolveInventoryReturnDto,
  ReturnItemDto,
} from './dto/inventory-return.dto';

@Injectable()
export class InventoryReturnsService {
  constructor(
    @InjectRepository(InventoryReturn)
    private readonly returnRepository: Repository<InventoryReturn>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
  ) {}

  async findAll(
    organizationId: string,
    filters?: {
      status?: string;
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const queryBuilder = this.returnRepository
      .createQueryBuilder('inventoryReturn')
      .where('inventoryReturn.organizationId = :organizationId', {
        organizationId,
      })
      .orderBy('inventoryReturn.createdAt', 'DESC');

    if (filters?.status) {
      queryBuilder.andWhere('inventoryReturn.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.supplierId) {
      queryBuilder.andWhere('inventoryReturn.supplierId = :supplierId', {
        supplierId: filters.supplierId,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere(
        'inventoryReturn.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string, organizationId: string) {
    const inventoryReturn = await this.returnRepository.findOne({
      where: { id, organizationId },
    });

    if (!inventoryReturn) {
      throw new NotFoundException('Return not found');
    }

    return inventoryReturn;
  }

  async create(
    createDto: CreateInventoryReturnDto & { organizationId: string },
  ): Promise<InventoryReturn> {
    const { organizationId } = createDto;

    const supplier = await this.supplierRepository.findOne({
      where: { id: createDto.supplierId, organizationId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (createDto.deliveryId) {
      const delivery = await this.deliveryRepository.findOne({
        where: { id: createDto.deliveryId, organizationId },
      });
      if (!delivery) {
        throw new NotFoundException('Delivery not found');
      }
    }

    const returnedItems = this.normalizeItems(createDto.returnedItems);

    const inventoryReturn = this.returnRepository.create({
      organizationId,
      supplierId: supplier.id,
      supplier: supplier.name,
      deliveryId: createDto.deliveryId || null,
      reason: createDto.reason || null,
      notes: createDto.notes || null,
      status: 'NOT_RESOLVED',
      returnedItems,
      replacementItems: null,
      returnedTotalCost: this.sumTotalCost(returnedItems),
      replacementTotalCost: null,
      resolvedAt: null,
    });

    const saved = await this.returnRepository.save(inventoryReturn);

    // Not-yet-resolved returns pull the returned items out of sellable
    // stock immediately (they've physically been set aside for the
    // supplier), regardless of when/if the return is ever resolved.
    await this.adjustStock(returnedItems, organizationId, -1);

    return saved;
  }

  async update(
    id: string,
    organizationId: string,
    updateDto: UpdateInventoryReturnDto,
  ): Promise<InventoryReturn> {
    const inventoryReturn = await this.findOne(id, organizationId);

    if (inventoryReturn.status !== 'NOT_RESOLVED') {
      throw new BadRequestException(
        'Resolved returns cannot be edited. Unresolve it first to make changes.',
      );
    }

    if (updateDto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: updateDto.supplierId, organizationId },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      inventoryReturn.supplierId = supplier.id;
      inventoryReturn.supplier = supplier.name;
    }

    if ('deliveryId' in updateDto) {
      if (updateDto.deliveryId) {
        const delivery = await this.deliveryRepository.findOne({
          where: { id: updateDto.deliveryId, organizationId },
        });
        if (!delivery) {
          throw new NotFoundException('Delivery not found');
        }
        inventoryReturn.deliveryId = updateDto.deliveryId;
      } else {
        inventoryReturn.deliveryId = null;
      }
    }

    if (updateDto.reason !== undefined) {
      inventoryReturn.reason = updateDto.reason || null;
    }
    if (updateDto.notes !== undefined) {
      inventoryReturn.notes = updateDto.notes || null;
    }

    if (updateDto.returnedItems) {
      const oldItems = inventoryReturn.returnedItems || [];
      const newItems = this.normalizeItems(updateDto.returnedItems);

      // Only the net quantity difference per product should move stock, so
      // adding, removing, or changing the quantity of a returned item
      // correctly adjusts the product's stock instead of double-applying
      // or ignoring the change.
      const deltaItems = this.computeDeltaItems(oldItems, newItems);
      await this.adjustStock(deltaItems, organizationId, -1);

      inventoryReturn.returnedItems = newItems;
      inventoryReturn.returnedTotalCost = this.sumTotalCost(newItems);
    }

    return this.returnRepository.save(inventoryReturn);
  }

  async resolve(
    id: string,
    organizationId: string,
    resolveDto: ResolveInventoryReturnDto,
  ): Promise<InventoryReturn> {
    const inventoryReturn = await this.findOne(id, organizationId);

    if (inventoryReturn.status === 'RESOLVED') {
      throw new BadRequestException(
        'This return is already resolved. Unresolve it first to change the replacement items.',
      );
    }

    const replacementItems = this.normalizeItems(resolveDto.replacementItems);

    inventoryReturn.replacementItems = replacementItems;
    inventoryReturn.replacementTotalCost = this.sumTotalCost(replacementItems);
    inventoryReturn.status = 'RESOLVED';
    inventoryReturn.resolvedAt = new Date();

    const saved = await this.returnRepository.save(inventoryReturn);

    // The supplier's replacement stock (which may be different products or
    // quantities than what was originally returned, as long as the cost
    // roughly lines up) is added back into sellable stock now.
    await this.adjustStock(replacementItems, organizationId, 1);

    return saved;
  }

  async unresolve(
    id: string,
    organizationId: string,
  ): Promise<InventoryReturn> {
    const inventoryReturn = await this.findOne(id, organizationId);

    if (inventoryReturn.status !== 'RESOLVED') {
      throw new BadRequestException('This return is not resolved.');
    }

    const replacementItems = inventoryReturn.replacementItems || [];

    // Reverse the replacement stock previously added, since the resolution
    // is being undone (e.g. to correct the replacement items before
    // re-resolving).
    await this.adjustStock(replacementItems, organizationId, -1);

    inventoryReturn.replacementItems = null;
    inventoryReturn.replacementTotalCost = null;
    inventoryReturn.resolvedAt = null;
    inventoryReturn.status = 'NOT_RESOLVED';

    return this.returnRepository.save(inventoryReturn);
  }

  async delete(id: string, organizationId: string) {
    const inventoryReturn = await this.findOne(id, organizationId);

    // Deleting a return should leave stock exactly as if it never existed:
    // give back whatever was deducted for the returned items, and reverse
    // any replacement stock that was added if it had been resolved.
    await this.adjustStock(
      inventoryReturn.returnedItems || [],
      organizationId,
      1,
    );
    if (inventoryReturn.status === 'RESOLVED') {
      await this.adjustStock(
        inventoryReturn.replacementItems || [],
        organizationId,
        -1,
      );
    }

    await this.returnRepository.remove(inventoryReturn);
    return { message: 'Return deleted successfully' };
  }

  async getStats(
    organizationId: string,
    filters?: { startDate?: string; endDate?: string },
  ) {
    const queryBuilder = this.returnRepository
      .createQueryBuilder('inventoryReturn')
      .where('inventoryReturn.organizationId = :organizationId', {
        organizationId,
      });

    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere(
        'inventoryReturn.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    const returns = await queryBuilder.getMany();

    const notResolved = returns.filter((r) => r.status === 'NOT_RESOLVED');
    const resolved = returns.filter((r) => r.status === 'RESOLVED');

    const totalReturnedCost = returns.reduce(
      (sum, r) => sum + Number(r.returnedTotalCost || 0),
      0,
    );
    const totalReplacementCost = resolved.reduce(
      (sum, r) => sum + Number(r.replacementTotalCost || 0),
      0,
    );

    return {
      totalReturns: returns.length,
      notResolvedCount: notResolved.length,
      resolvedCount: resolved.length,
      totalReturnedCost,
      totalReplacementCost,
    };
  }

  /** Recomputes each item's totalCost server-side so it can never drift from quantity * unitCost. */
  private normalizeItems(items: ReturnItemDto[]): InventoryReturnItem[] {
    return items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: Math.round(item.quantity * item.unitCost * 100) / 100,
    }));
  }

  private sumTotalCost(items: InventoryReturnItem[]): number {
    return (
      Math.round(items.reduce((sum, i) => sum + i.totalCost, 0) * 100) / 100
    );
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
   * Computes the net per-product quantity difference between an old and
   * new set of items, so editing an item list only ever moves stock by the
   * actual change instead of re-applying the full new list.
   */
  private computeDeltaItems(
    oldItems: Array<{ productId: string; quantity: number }>,
    newItems: Array<{ productId: string; quantity: number }>,
  ): Array<{ productId: string; quantity: number }> {
    const oldQuantityByProduct = this.sumQuantitiesByProduct(oldItems);
    const newQuantityByProduct = this.sumQuantitiesByProduct(newItems);
    const productIds = new Set([
      ...oldQuantityByProduct.keys(),
      ...newQuantityByProduct.keys(),
    ]);

    const deltas: Array<{ productId: string; quantity: number }> = [];
    for (const productId of productIds) {
      const delta =
        (newQuantityByProduct.get(productId) || 0) -
        (oldQuantityByProduct.get(productId) || 0);
      if (delta !== 0) {
        deltas.push({ productId, quantity: delta });
      }
    }
    return deltas;
  }

  /**
   * Applies `multiplier * quantity` to each product's stock (multiplier of
   * -1 deducts, +1 adds back). Items are summed per product first so a
   * product appearing more than once in the same list is only fetched and
   * saved once.
   */
  private async adjustStock(
    items: Array<{ productId: string; quantity: number }>,
    organizationId: string,
    multiplier: 1 | -1,
  ) {
    const quantityByProduct = this.sumQuantitiesByProduct(items);
    for (const [productId, quantity] of quantityByProduct) {
      if (quantity === 0) continue;

      const product = await this.productRepository.findOne({
        where: { id: productId, organizationId },
      });
      if (product) {
        product.stockQuantity += multiplier * quantity;
        await this.productRepository.save(product);
      }
    }
  }
}
