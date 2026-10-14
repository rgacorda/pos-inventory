import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { CreateProductDto, UpdateProductDto } from './dto';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
  ) {}

  private computePackPrices(dto: Partial<CreateProductDto> | ProductEntity): void {
    const cost = Number(dto.cost) || 0;

    if (!dto.packQuantity) {
      // Use null (not undefined) so an update actually clears the column.
      dto.packPrice = null as any;
    } else if (dto.packPrice != null && Number(dto.packPrice) > 0) {
      // Keep manually entered pack price (legacy or user override)
      dto.packPrice = Number(dto.packPrice);
    } else {
      const base = cost * Number(dto.packQuantity);
      const pct = Number(dto.packMarkupPercentage) || 0;
      const fixed = Number(dto.packMarkupFixed) || 0;
      const computed = base + (base * pct) / 100 + fixed;
      dto.packPrice = computed > 0 ? computed : (null as any);
    }

    if (!dto.halfPackQuantity) {
      dto.halfPackPrice = null as any;
    } else if (dto.halfPackPrice != null && Number(dto.halfPackPrice) > 0) {
      // Keep manually entered half-pack price
      dto.halfPackPrice = Number(dto.halfPackPrice);
    } else {
      const base = cost * Number(dto.halfPackQuantity);
      const pct = Number(dto.halfPackMarkupPercentage) || 0;
      const fixed = Number(dto.halfPackMarkupFixed) || 0;
      const computed = base + (base * pct) / 100 + fixed;
      dto.halfPackPrice = computed > 0 ? computed : (null as any);
    }
  }

  async create(createProductDto: CreateProductDto, requestingUser: any) {
    const { sku, organizationId } = createProductDto;

    // Set organization from requesting user if not super admin
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      createProductDto.organizationId = requestingUser.organizationId;
    } else if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Check if SKU already exists in this organization
    const existing = await this.productsRepository.findOne({
      where: {
        sku,
        organizationId: createProductDto.organizationId,
      },
    });

    if (existing) {
      throw new ConflictException(this.skuConflictMessage(existing));
    }

    this.computePackPrices(createProductDto);
    this.assertNonNegativeProfit(createProductDto);

    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async findAll(
    requestingUser: any,
    filters?: { supplierId?: string; archived?: boolean },
  ) {
    if (filters?.archived) {
      this.assertAdmin(requestingUser);
    }

    const query = this.productsRepository
      .createQueryBuilder('product')
      // Only pull the supplier's name (never website credentials/notes).
      .leftJoin('product.supplier', 'supplier')
      .addSelect(['supplier.id', 'supplier.name']);

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('product.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    query.andWhere(
      filters?.archived
        ? 'product.deletedAt IS NOT NULL'
        : 'product.deletedAt IS NULL',
    );

    if (filters?.supplierId) {
      query.andWhere('product.supplierId = :supplierId', {
        supplierId: filters.supplierId,
      });
    }

    return query.orderBy('product.name', 'ASC').getMany();
  }

  async findOne(id: string, requestingUser: any) {
    const product = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.supplier', 'supplier')
      .addSelect(['supplier.id', 'supplier.name'])
      .where('product.id = :id', { id })
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (product.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    requestingUser: any,
  ) {
    const product = await this.findOne(id, requestingUser);

    // Check if new SKU conflicts
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existing = await this.productsRepository.findOne({
        where: {
          sku: updateProductDto.sku,
          organizationId: product.organizationId,
        },
      });

      if (existing) {
        throw new ConflictException(this.skuConflictMessage(existing));
      }
    }

    if (product.deletedAt) {
      throw new BadRequestException(
        'Archived products cannot be edited. Restore the product first.',
      );
    }

    // Stock changes on the product form are admin-only. Managers submit a
    // physical count on Variance Inventory, and an admin applies it.
    if (requestingUser.role === UserRole.MANAGER && updateProductDto.stockQuantity !== undefined) {
      const nextStock = Number(updateProductDto.stockQuantity);
      const currentStock = Number(product.stockQuantity) || 0;
      if (nextStock !== currentStock) {
        throw new ForbiddenException('Only an admin can change stock quantity');
      }
      delete updateProductDto.stockQuantity;
    }

    const before = this.snapshotProduct(product);

    // Drop the joined supplier relation before assign/save. TypeORM's save()
    // prefers a loaded ManyToOne over the FK column, so changing supplierId
    // while `supplier` is still populated would stamp the old supplier back
    // and the request would still return 200 ("Product updated").
    delete (product as any).supplier;
    delete (updateProductDto as any).editHistory;

    Object.assign(product, updateProductDto);

    if (Object.prototype.hasOwnProperty.call(updateProductDto, 'supplierId')) {
      product.supplierId = updateProductDto.supplierId || null;
    }

    this.computePackPrices(product);
    this.assertNonNegativeProfit(product);
    await this.recordProductEdits(product, before, requestingUser);
    await this.productsRepository.save(product);
    // Reload with the supplier join so the response matches what was saved.
    return this.findOne(id, requestingUser);
  }

  async dismissEdits(id: string, requestingUser: any) {
    this.assertAdmin(requestingUser);
    const product = await this.findOne(id, requestingUser);
    const history = product.editHistory || [];
    if (history.length === 0) {
      return product;
    }

    const latest = history.reduce(
      (max, entry) => (entry.editedAt > max ? entry.editedAt : max),
      history[0].editedAt,
    );
    delete (product as any).supplier;
    // A second past the latest edit, so timestamp rounding cannot leave
    // that edit visible. A later save is still newer than this.
    product.editHistoryDismissedAt = new Date(new Date(latest).getTime() + 1000);
    await this.productsRepository.save(product);
    return this.findOne(id, requestingUser);
  }

  async archive(id: string, requestingUser: any) {
    this.assertAdmin(requestingUser);
    const product = await this.findOne(id, requestingUser);

    if (product.deletedAt) {
      throw new BadRequestException('Product is already archived');
    }

    delete (product as any).supplier;
    this.stampArchived(product, requestingUser);
    await this.productsRepository.save(product);
  }

  async restore(id: string, requestingUser: any) {
    this.assertAdmin(requestingUser);
    const product = await this.findOne(id, requestingUser);

    if (!product.deletedAt) {
      throw new BadRequestException('Product is not archived');
    }

    delete (product as any).supplier;
    product.deletedAt = null;
    product.deletedByUserId = null;
    product.deletedByName = null;
    await this.productsRepository.save(product);
    return this.findOne(id, requestingUser);
  }

  async remove(id: string, requestingUser: any) {
    this.assertAdmin(requestingUser);

    const product = await this.findOne(id, requestingUser);

    if (!product.deletedAt) {
      throw new BadRequestException(
        'Archive the product before permanently deleting it',
      );
    }

    delete (product as any).supplier;

    try {
      await this.productsRepository.remove(product);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        // Handle foreign key constraint violations
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('foreign key constraint') ||
          errorMessage.includes('violates foreign key') ||
          errorMessage.includes('fk_')
        ) {
          throw new BadRequestException(
            'Cannot delete product as it is being used in orders, inventory transactions, or other records. Please remove all related records first.',
          );
        }
      }
      throw error;
    }
  }

  async findByOrganization(organizationId: string) {
    return this.productsRepository.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findByBarcode(barcode: string, requestingUser: any) {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .where('product.barcode = :barcode', { barcode });

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.andWhere('product.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    query.andWhere('product.deletedAt IS NULL');

    // Order by stock quantity DESC (products with stock first), then by name
    return query
      .orderBy('product.stockQuantity', 'DESC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
  }

  private snapshotProduct(product: ProductEntity) {
    return {
      name: product.name,
      sku: product.sku,
      category: product.category,
      barcode: product.barcode,
      status: product.status,
      cost: product.cost,
      price: product.price,
      stockQuantity: product.stockQuantity,
      packQuantity: product.packQuantity,
      packPrice: product.packPrice,
      halfPackQuantity: product.halfPackQuantity,
      halfPackPrice: product.halfPackPrice,
      supplierId: product.supplierId,
      supplierName: product.supplier?.name || null,
    };
  }

  private async recordProductEdits(
    product: ProductEntity,
    before: ReturnType<ProductsService['snapshotProduct']>,
    user?: { id?: string; userId?: string; name?: string; email?: string },
  ) {
    const supplierName =
      product.supplierId === before.supplierId
        ? before.supplierName
        : await this.supplierName(product.supplierId, product.organizationId);

    const changes: Array<{ label: string; from: string; to: string }> = [];
    const track = (
      label: string,
      from: string,
      to: string,
    ) => {
      if (from !== to) changes.push({ label, from, to });
    };

    track('Name', this.displayText(before.name), this.displayText(product.name));
    track('SKU', this.displayText(before.sku), this.displayText(product.sku));
    track('Category', this.displayText(before.category), this.displayText(product.category));
    track('Barcode', this.displayText(before.barcode), this.displayText(product.barcode));
    track('Status', this.displayText(before.status), this.displayText(product.status));
    track('Supplier', this.displayText(before.supplierName), this.displayText(supplierName));
    track('Cost', this.displayMoney(before.cost), this.displayMoney(product.cost));
    track('Selling price', this.displayMoney(before.price), this.displayMoney(product.price));
    track('Stock', this.displayInt(before.stockQuantity), this.displayInt(product.stockQuantity));
    track('Pack quantity', this.displayInt(before.packQuantity), this.displayInt(product.packQuantity));
    track('Pack price', this.displayMoney(before.packPrice), this.displayMoney(product.packPrice));
    track(
      'Half-pack quantity',
      this.displayInt(before.halfPackQuantity),
      this.displayInt(product.halfPackQuantity),
    );
    track(
      'Half-pack price',
      this.displayMoney(before.halfPackPrice),
      this.displayMoney(product.halfPackPrice),
    );

    if (changes.length === 0) return;

    product.editHistory = [
      ...(product.editHistory || []),
      {
        editedAt: new Date().toISOString(),
        editedByUserId: user?.id || user?.userId || null,
        editedByName: user?.name || user?.email || 'Unknown user',
        changes,
      },
    ];
  }

  private async supplierName(id: string | null, organizationId: string) {
    if (!id) return null;
    const supplier = await this.productsRepository.manager.findOne(Supplier, {
      where: { id, organizationId },
      select: { id: true, name: true },
    });
    return supplier?.name || null;
  }

  private displayText(value: unknown) {
    if (value == null) return '—';
    const text = String(value).trim();
    return text || '—';
  }

  private displayMoney(value: unknown) {
    if (value == null || value === '') return '—';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return `₱${amount.toFixed(2)}`;
  }

  private displayInt(value: unknown) {
    if (value == null || value === '') return '—';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return String(amount);
  }

  private assertAdmin(user: { role?: string }) {
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only an admin can do that');
    }
  }

  private skuConflictMessage(existing: ProductEntity) {
    return existing.deletedAt
      ? 'This SKU belongs to an archived product. Restore it from Archive or choose another SKU.'
      : 'SKU already exists in this organization';
  }

  private stampArchived(
    record: { deletedAt: Date | null; deletedByUserId: string | null; deletedByName: string | null },
    user: { id?: string; userId?: string; name?: string; email?: string },
  ) {
    record.deletedAt = new Date();
    record.deletedByUserId = user.id || user.userId || null;
    record.deletedByName = user.name || user.email || 'Unknown user';
  }

  /**
   * Unit, pack, and half-pack selling prices may match cost (zero profit)
   * but cannot go below it.
   */
  private assertNonNegativeProfit(dto: {
    cost?: number | null;
    price?: number | null;
    packQuantity?: number | null;
    packPrice?: number | null;
    halfPackQuantity?: number | null;
    halfPackPrice?: number | null;
  }) {
    const cost = Number(dto.cost) || 0;
    const price = Number(dto.price);
    if (!Number.isFinite(price) || Math.round((price - cost) * 100) < 0) {
      throw new BadRequestException(
        'Unit selling price cannot be below cost. A profit of zero is allowed.',
      );
    }

    const packQty = Number(dto.packQuantity) || 0;
    if (packQty > 0 && dto.packPrice != null && Number(dto.packPrice) > 0) {
      const packPrice = Number(dto.packPrice);
      if (Math.round((packPrice - cost * packQty) * 100) < 0) {
        throw new BadRequestException(
          'Pack price cannot be below the cost of that pack. A profit of zero is allowed.',
        );
      }
    }

    const halfQty = Number(dto.halfPackQuantity) || 0;
    if (
      halfQty > 0 &&
      dto.halfPackPrice != null &&
      Number(dto.halfPackPrice) > 0
    ) {
      const halfPrice = Number(dto.halfPackPrice);
      if (Math.round((halfPrice - cost * halfQty) * 100) < 0) {
        throw new BadRequestException(
          'Half-pack price cannot be below the cost of that half-pack. A profit of zero is allowed.',
        );
      }
    }
  }
}
