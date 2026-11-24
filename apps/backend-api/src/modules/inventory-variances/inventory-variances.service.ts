import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { InventoryVarianceCount } from '../../entities/inventory-variance-count.entity';
import { OrganizationEntity } from '../../entities/organization.entity';
import { ProductEntity } from '../../entities/product.entity';
import { UserEntity } from '../../entities/user.entity';
import {
  adjustTrackedStock,
  toStockUnits,
} from '../../common/stock-quantity';
import {
  businessCalendarDay,
  businessTimeZone,
} from '../financials/financials.range';
import { UserRole } from '@pos/shared-types';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isVarianceWindowOpen(
  today: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  if (!startDate || !endDate) return false;
  return today >= startDate && today <= endDate;
}

/**
 * The baseline is the stock the counter was looking at. A later save of the
 * same count must keep that number, so sales and deliveries after the count
 * are still in the shelf when quantities are updated after close.
 */
export function resolvePendingBaseline(
  existingBaseline: number | null,
  reportedBaseline: number | null | undefined,
  liveStock: number,
) {
  if (existingBaseline !== null) return toStockUnits(existingBaseline);
  if (
    reportedBaseline !== undefined &&
    reportedBaseline !== null &&
    Number.isFinite(Number(reportedBaseline))
  ) {
    return Math.max(0, toStockUnits(reportedBaseline));
  }
  return Math.max(0, toStockUnits(liveStock));
}

function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; driverError?: { code?: string } };
  return candidate?.code === '23505' || candidate?.driverError?.code === '23505';
}

@Injectable()
export class InventoryVariancesService implements OnModuleInit {
  private readonly logger = new Logger(InventoryVariancesService.name);

  constructor(
    @InjectRepository(InventoryVarianceCount)
    private countsRepository: Repository<InventoryVarianceCount>,
    @InjectRepository(OrganizationEntity)
    private organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
    private dataSource: DataSource,
  ) {}

  /**
   * One pending count per product. A second row would be applied again
   * after close and the difference would be counted twice.
   */
  async onModuleInit() {
    try {
      await this.dataSource.query(`
        DELETE FROM inventory_variance_counts AS extra
        WHERE extra.status = 'PENDING'
          AND extra.id IN (
            SELECT id FROM (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY "organizationId", "productId"
                       ORDER BY "createdAt" ASC, id ASC
                     ) AS rn
              FROM inventory_variance_counts
              WHERE status = 'PENDING'
            ) ranked
            WHERE ranked.rn > 1
          )
      `);
      await this.dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_variance_one_pending_count"
        ON inventory_variance_counts ("organizationId", "productId")
        WHERE status = 'PENDING'
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Could not enforce one pending variance count: ${message}`);
    }
  }

  private requireOrganization(user: { organizationId?: string }) {
    if (!user.organizationId) {
      throw new ForbiddenException('Organization is required');
    }
    return user.organizationId;
  }

  private isCalendarDate(value: string) {
    if (!CALENDAR_DATE.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const probe = new Date(Date.UTC(year, month - 1, day));
    return (
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day
    );
  }

  async getWindow(user: { organizationId?: string }) {
    const organizationId = this.requireOrganization(user);
    const organization = await this.organizationsRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const startDate = organization.settings?.varianceCountStart ?? null;
    const endDate = organization.settings?.varianceCountEnd ?? null;
    const today = businessCalendarDay(new Date(), 0, businessTimeZone()).date;
    return {
      startDate,
      endDate,
      today,
      open: isVarianceWindowOpen(today, startDate, endDate),
    };
  }

  async updateWindow(
    user: { organizationId?: string },
    startDate: string | null | undefined,
    endDate: string | null | undefined,
  ) {
    if (startDate === undefined || endDate === undefined) {
      throw new BadRequestException('Start date and end date are required');
    }
    if ((startDate === null) !== (endDate === null)) {
      throw new BadRequestException(
        'Set both a start date and an end date, or clear both to close counting',
      );
    }
    if (startDate && endDate) {
      if (!this.isCalendarDate(startDate) || !this.isCalendarDate(endDate)) {
        throw new BadRequestException('Use a real calendar date');
      }
      if (startDate > endDate) {
        throw new BadRequestException(
          'Start date must be on or before the end date',
        );
      }
    }

    const organizationId = this.requireOrganization(user);
    const organization = await this.organizationsRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    organization.settings = {
      ...(organization.settings ?? {}),
      varianceCountStart: startDate,
      varianceCountEnd: endDate,
    };
    await this.organizationsRepository.save(organization);
    return this.getWindow(user);
  }

  /** Admins can always count. Everyone else needs the shop window to be open. */
  private async assertCountingOpen(user: {
    organizationId?: string;
    role?: string;
  }) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return;
    }
    const window = await this.getWindow(user);
    if (window.open) return;
    if (window.startDate && window.endDate) {
      throw new ForbiddenException(
        `Variance counting is closed. Employees can update counts from ${window.startDate} through ${window.endDate}.`,
      );
    }
    throw new ForbiddenException(
      'Variance counting is closed. An admin must open a date range first.',
    );
  }

  /** Pending counts cannot change an unlimited product, so drop them. */
  private async clearPendingUnlimitedCounts(organizationId: string) {
    const unlimited = await this.productsRepository.find({
      where: { organizationId, infiniteStock: true },
      select: { id: true },
    });
    if (unlimited.length === 0) return;
    await this.countsRepository.delete({
      organizationId,
      status: 'PENDING',
      productId: In(unlimited.map((product) => product.id)),
    });
  }

  /**
   * An archived or permanently deleted product is already gone. Its pending
   * count cannot update stock, so drop it instead of asking anyone to skip it.
   */
  private async clearPendingGoneProductCounts(organizationId: string) {
    const pending = await this.countsRepository.find({
      where: { organizationId, status: 'PENDING' },
      select: { id: true, productId: true },
    });
    if (pending.length === 0) return;

    const products = await this.productsRepository.find({
      where: {
        organizationId,
        id: In([...new Set(pending.map((count) => count.productId))]),
      },
      select: { id: true, deletedAt: true },
    });
    const activeIds = new Set(
      products.filter((product) => !product.deletedAt).map((product) => product.id),
    );
    const dropIds = pending
      .filter((count) => !activeIds.has(count.productId))
      .map((count) => count.id);
    if (dropIds.length === 0) return;
    await this.countsRepository.delete({ id: In(dropIds) });
  }

  async getWorksheet(user: { organizationId?: string }) {
    const organizationId = this.requireOrganization(user);
    await this.clearPendingUnlimitedCounts(organizationId);
    await this.clearPendingGoneProductCounts(organizationId);

    const products = await this.productsRepository.find({
      where: { organizationId, deletedAt: IsNull(), infiniteStock: false },
      order: { name: 'ASC' },
    });

    const pending = await this.countsRepository.find({
      where: { organizationId, status: 'PENDING' },
    });

    const userIds = [...new Set(pending.map((count) => count.countedByUserId))];
    const users = userIds.length
      ? await this.usersRepository.find({
          where: { id: In(userIds) },
          select: { id: true, name: true },
        })
      : [];
    const userNames = new Map(users.map((entry) => [entry.id, entry.name]));
    const pendingByProduct = new Map<string, InventoryVarianceCount>();
    for (const count of pending) {
      const current = pendingByProduct.get(count.productId);
      if (!current || count.createdAt < current.createdAt) {
        pendingByProduct.set(count.productId, count);
      }
    }

    return products.map((product) => {
      const stockQuantity = Number(product.stockQuantity) || 0;
      const count = pendingByProduct.get(product.id) ?? null;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        status: product.status,
        stockQuantity,
        cost: Number(product.cost) || 0,
        packQuantity: product.packQuantity ? Number(product.packQuantity) : null,
        halfPackQuantity: product.halfPackQuantity ? Number(product.halfPackQuantity) : null,
        count: count
          ? {
              id: count.id,
              countedQuantity: count.countedQuantity,
              systemQuantity: count.systemQuantity,
              variance: count.countedQuantity - Number(count.systemQuantity),
              countedByName: userNames.get(count.countedByUserId) || 'Unknown',
              updatedAt: count.updatedAt,
            }
          : null,
      };
    });
  }

  async liveStock(user: { organizationId?: string }, productId: string) {
    const organizationId = this.requireOrganization(user);
    const product = await this.productsRepository.findOne({
      where: { id: productId, organizationId, deletedAt: IsNull() },
      select: { id: true, stockQuantity: true, infiniteStock: true },
    });
    if (!product || product.infiniteStock) {
      throw new NotFoundException('Product not found');
    }
    return {
      productId: product.id,
      stockQuantity: Math.max(0, toStockUnits(product.stockQuantity)),
    };
  }

  async saveCounts(
    user: { organizationId?: string; id: string; role?: string },
    items: {
      productId: string;
      countedQuantity: number;
      systemQuantity?: number;
    }[],
  ) {
    await this.assertCountingOpen(user);
    const organizationId = this.requireOrganization(user);
    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Each product can only be counted once per save');
    }

    const products = await this.productsRepository.find({
      where: { organizationId, id: In(productIds) },
    });
    const foundIds = new Set(products.map((product) => product.id));
    const goneIds = [
      ...productIds.filter((id) => !foundIds.has(id)),
      ...products.filter((product) => product.deletedAt).map((product) => product.id),
    ];
    if (goneIds.length > 0) {
      await this.countsRepository.delete({
        organizationId,
        status: 'PENDING',
        productId: In(goneIds),
      });
    }

    const activeProducts = products.filter((product) => !product.deletedAt);
    if (activeProducts.some((product) => product.infiniteStock)) {
      throw new BadRequestException(
        'Unlimited stock products are not counted',
      );
    }
    const activeIds = new Set(activeProducts.map((product) => product.id));
    const activeItems = items.filter((item) => activeIds.has(item.productId));
    if (activeItems.length === 0) {
      return this.getWorksheet(user);
    }

    const productMap = new Map(activeProducts.map((product) => [product.id, product]));
    const orderedIds = [...activeIds].sort();

    const writePending = async (manager: EntityManager) => {
      // Lock pending counts in product id order, the same order used when
      // quantities are updated after close. Product rows are not locked here,
      // so a sale or a delivery does not wait on someone saving a count.
      for (const productId of orderedIds) {
        await manager.find(InventoryVarianceCount, {
          where: { organizationId, status: 'PENDING', productId },
          order: { createdAt: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      }

      for (const productId of orderedIds) {
        const item = activeItems.find((entry) => entry.productId === productId);
        if (!item) continue;
        const existingRows = await manager.find(InventoryVarianceCount, {
          where: { organizationId, status: 'PENDING', productId },
          order: { createdAt: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        const [current, ...extras] = existingRows;
        if (extras.length > 0) {
          await manager.delete(InventoryVarianceCount, {
            id: In(extras.map((count) => count.id)),
          });
        }
        if (current) {
          current.countedQuantity = item.countedQuantity;
          current.countedByUserId = user.id;
          await manager.save(current);
          continue;
        }
        const product = productMap.get(productId);
        await manager.save(
          manager.create(InventoryVarianceCount, {
            organizationId,
            productId,
            countedQuantity: item.countedQuantity,
            systemQuantity: resolvePendingBaseline(
              null,
              item.systemQuantity,
              Number(product?.stockQuantity) || 0,
            ),
            status: 'PENDING' as const,
            countedByUserId: user.id,
          }),
        );
      }
    };

    try {
      await this.dataSource.transaction(writePending);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await this.dataSource.transaction(writePending);
    }
    return this.getWorksheet(user);
  }

  async check(user: { organizationId?: string }, productIds?: string[]) {
    const organizationId = this.requireOrganization(user);
    await this.clearPendingGoneProductCounts(organizationId);
    const counts = await this.countsRepository.find({
      where: {
        organizationId,
        status: 'PENDING',
        ...(productIds?.length ? { productId: In(productIds) } : {}),
      },
    });
    if (counts.length === 0) {
      return { errors: [], readyCount: 0 };
    }

    const products = await this.productsRepository.find({
      where: { organizationId, id: In(counts.map((count) => count.productId)) },
      select: { id: true, name: true, sku: true, deletedAt: true, infiniteStock: true },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const errors = counts.flatMap((count) => {
      const product = productsById.get(count.productId);
      if (!product || product.deletedAt) {
        return [];
      }
      if (product.infiniteStock) {
        return [
          {
            productId: count.productId,
            countId: count.id,
            name: product.name,
            sku: product.sku,
            reason:
              'This product has unlimited stock, so a count cannot change its quantity.',
          },
        ];
      }
      return [];
    });

    const blocked = new Set(errors.map((error) => error.productId));
    const readyCount = counts.filter((count) => {
      const product = productsById.get(count.productId);
      if (!product || product.deletedAt || blocked.has(count.productId)) return false;
      return true;
    }).length;
    return { errors, readyCount };
  }

  /** One count per product. Extras are dropped so after-close update applies the difference once. */
  private keepOldestPending(counts: InventoryVarianceCount[]) {
    const grouped = new Map<string, InventoryVarianceCount[]>();
    for (const count of counts) {
      const list = grouped.get(count.productId) ?? [];
      list.push(count);
      grouped.set(count.productId, list);
    }
    const kept: InventoryVarianceCount[] = [];
    const extraIds: string[] = [];
    for (const list of grouped.values()) {
      list.sort(
        (a, b) =>
          +new Date(a.createdAt) - +new Date(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
      kept.push(list[0]);
      for (const extra of list.slice(1)) extraIds.push(extra.id);
    }
    kept.sort((a, b) => a.productId.localeCompare(b.productId));
    return { counts: kept, extraIds };
  }

  async apply(
    user: { organizationId?: string; id: string },
    productIds?: string[],
    skipProductIds?: string[],
  ) {
    const organizationId = this.requireOrganization(user);
    await this.clearPendingGoneProductCounts(organizationId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const skip = new Set(skipProductIds ?? []);
      const lockedCounts = (
        await queryRunner.manager.find(InventoryVarianceCount, {
          where: {
            organizationId,
            status: 'PENDING',
            ...(productIds?.length ? { productId: In(productIds) } : {}),
          },
          order: { productId: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        })
      ).filter((count) => !skip.has(count.productId));

      if (productIds?.length) {
        const found = new Set(lockedCounts.map((count) => count.productId));
        const missing = productIds.filter((id) => !found.has(id));
        if (missing.length > 0) {
          throw new BadRequestException('Save the count before updating stock');
        }
      }

      const { counts, extraIds } = this.keepOldestPending(lockedCounts);
      if (extraIds.length > 0) {
        await queryRunner.manager.delete(InventoryVarianceCount, {
          id: In(extraIds),
        });
      }

      if (counts.length === 0) {
        throw new BadRequestException('No saved counts to apply');
      }

      const items: {
        productId: string;
        name: string;
        previousQuantity: number;
        countedQuantity: number;
        nextQuantity: number;
      }[] = [];

      const existingProducts = await queryRunner.manager
        .createQueryBuilder(ProductEntity, 'product')
        .select(['product.id', 'product.deletedAt'])
        .where('product.organizationId = :organizationId', { organizationId })
        .andWhere('product.id IN (:...ids)', {
          ids: counts.map((count) => count.productId),
        })
        .getMany();
      const activeIds = new Set(
        existingProducts
          .filter((product) => !product.deletedAt)
          .map((product) => product.id),
      );
      const gone = counts.filter((count) => !activeIds.has(count.productId));
      if (gone.length > 0) {
        await queryRunner.manager.delete(InventoryVarianceCount, {
          id: In(gone.map((count) => count.id)),
        });
      }
      const applicable = counts.filter((count) => activeIds.has(count.productId));
      if (applicable.length === 0) {
        throw new BadRequestException('No saved counts to apply');
      }

      for (const count of applicable) {
        const product = await queryRunner.manager
          .createQueryBuilder(ProductEntity, 'product')
          .setLock('pessimistic_write')
          .where('product.id = :id', { id: count.productId })
          .andWhere('product.organizationId = :organizationId', { organizationId })
          .getOne();
        if (!product || product.deletedAt) {
          await queryRunner.manager.delete(InventoryVarianceCount, { id: count.id });
          continue;
        }
        if (product.infiniteStock) {
          throw new BadRequestException(
            `${product.name} has unlimited stock, so its quantity cannot be updated`,
          );
        }

        const liveQuantity = Number(product.stockQuantity);
        const previousQuantity = Number.isFinite(liveQuantity) ? liveQuantity : 0;
        // systemQuantity is the stock the counter was looking at. Sales and
        // deliveries after that stay in the live quantity; only the original
        // difference (counted - snapshot) is applied after close. A negative
        // difference subtracts, a positive one adds. The saved count is not
        // replaced by later stock movement.
        const snapshot = toStockUnits(count.systemQuantity);
        const counted = toStockUnits(count.countedQuantity);
        const adjustment = counted - snapshot;
        const nextQuantity = previousQuantity + adjustment;
        if (adjustment !== 0) {
          await adjustTrackedStock(
            queryRunner.manager,
            product.id,
            adjustment,
            organizationId,
          );
        }

        count.status = 'APPLIED';
        count.appliedByUserId = user.id;
        count.appliedAt = new Date();
        await queryRunner.manager.save(count);

        items.push({
          productId: product.id,
          name: product.name,
          previousQuantity,
          countedQuantity: count.countedQuantity,
          nextQuantity,
        });
      }

      await queryRunner.commitTransaction();
      return {
        applied: items.length,
        updated: items.filter((item) => item.previousQuantity !== item.nextQuantity).length,
        items,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, user: { organizationId?: string; role?: string }) {
    await this.assertCountingOpen(user);
    const organizationId = this.requireOrganization(user);
    const count = await this.countsRepository.findOne({
      where: { id, organizationId },
    });
    if (!count) {
      throw new NotFoundException('Count not found');
    }
    if (count.status !== 'PENDING') {
      throw new BadRequestException('Only a pending count can be cleared');
    }
    await this.countsRepository.remove(count);
  }
}
