import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Supplier } from '../../entities/supplier.entity';
import { SupplierIncentive } from '../../entities/supplier-incentive.entity';
import { ProductEntity } from '../../entities/product.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { CreateSupplierIncentiveDto } from './dto/supplier-incentive.dto';
import {
  averageRecentPurchases,
  suggestedPurchaseQuantity,
} from '@pos/shared-utils';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
    @InjectRepository(SupplierIncentive)
    private supplierIncentivesRepository: Repository<SupplierIncentive>,
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
    @InjectRepository(InventoryDelivery)
    private deliveriesRepository: Repository<InventoryDelivery>,
  ) {}

  async findAll(organizationId: string): Promise<Supplier[]> {
    return this.suppliersRepository.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOne({
      where: { id, organizationId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async create(data: Partial<Supplier>): Promise<Supplier> {
    const supplier = this.suppliersRepository.create(data);
    return this.suppliersRepository.save(supplier);
  }

  async update(
    id: string,
    organizationId: string,
    data: Partial<Supplier>,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id, organizationId);
    Object.assign(supplier, data);
    return this.suppliersRepository.save(supplier);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const supplier = await this.findOne(id, organizationId);
    await this.suppliersRepository.remove(supplier);
  }

  async recordIncentive(
    supplierId: string,
    organizationId: string,
    dto: CreateSupplierIncentiveDto,
  ): Promise<Supplier> {
    const supplier = await this.findOne(supplierId, organizationId);
    const incentiveDate = new Date(dto.incentiveDate);

    const incentive = this.supplierIncentivesRepository.create({
      organizationId,
      supplierId,
      amount: dto.amount,
      incentiveDate,
      notes: dto.notes,
    });
    await this.supplierIncentivesRepository.save(incentive);

    supplier.totalIncentiveGiven =
      Number(supplier.totalIncentiveGiven || 0) + dto.amount;
    supplier.lastIncentiveDate = incentiveDate;

    return this.suppliersRepository.save(supplier);
  }

  async getIncentives(
    supplierId: string,
    organizationId: string,
  ): Promise<SupplierIncentive[]> {
    await this.findOne(supplierId, organizationId);
    return this.supplierIncentivesRepository.find({
      where: { supplierId, organizationId },
      order: { incentiveDate: 'DESC' },
    });
  }

  /**
   * Average received purchase size for products currently supplied by
   * this vendor. A product stays with the supplier of its latest received
   * delivery, and only that supplier's receipts are averaged, so a
   * previous vendor's quantities are not mixed into the next order.
   * Pending, cancelled, deleted, and free lines are excluded.
   */
  async getPurchaseAverages(supplierId: string, organizationId: string) {
    const supplier = await this.findOne(supplierId, organizationId);
    const products = await this.productsRepository.find({
      where: { organizationId, supplierId, deletedAt: IsNull() },
      select: ['id', 'packQuantity', 'halfPackQuantity'],
    });
    if (products.length === 0) return [];

    const currentIds = new Set(products.map((product) => product.id));
    const rows: Array<{
      productId: string | null;
      deliveryId: string;
      deliveryDate: Date | string;
      createdAt: Date | string | null;
      quantity: string | number;
    }> = await this.deliveriesRepository.query(
      `SELECT elem->>'productId' AS "productId",
              d.id AS "deliveryId",
              d."deliveryDate" AS "deliveryDate",
              d."createdAt" AS "createdAt",
              CASE
                WHEN jsonb_typeof(elem->'quantity') = 'number'
                  THEN (elem->>'quantity')::numeric
                WHEN elem->>'quantity' ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN (elem->>'quantity')::numeric
                ELSE 0
              END AS quantity
       FROM inventory_deliveries d
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.items, '[]'::jsonb)) AS elem
       WHERE d."organizationId" = $1
         AND (
           d."supplierId" = $2
           OR (
             d."supplierId" IS NULL
             AND lower(btrim(d.supplier)) = lower(btrim($3))
           )
         )
         AND d.status = 'RECEIVED'
         AND d."deletedAt" IS NULL
         AND COALESCE(elem->>'isFree', 'false') <> 'true'`,
      [organizationId, supplierId, supplier.name],
    );

    const averages = averageRecentPurchases(
      rows
        .filter((row) => row.productId && currentIds.has(row.productId))
        .map((row) => ({
          productId: row.productId as string,
          deliveryId: row.deliveryId,
          deliveryDate: row.deliveryDate,
          createdAt: row.createdAt,
          quantity: Number(row.quantity),
        })),
    );

    const packByProduct = new Map(
      products.map((product) => [
        product.id,
        {
          packQuantity: product.packQuantity,
          halfPackQuantity: product.halfPackQuantity,
        },
      ]),
    );

    return averages.map((average) => {
      const suggestion = suggestedPurchaseQuantity(
        average.averageQuantity,
        packByProduct.get(average.productId),
      );
      return {
        ...average,
        suggestedQuantity: suggestion.quantity,
        suggestedQuantityType: suggestion.quantityType,
      };
    });
  }
}
