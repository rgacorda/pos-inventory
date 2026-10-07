import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { InventoryVarianceCount } from '../../entities/inventory-variance-count.entity';
import { ProductEntity } from '../../entities/product.entity';
import { UserEntity } from '../../entities/user.entity';

@Injectable()
export class InventoryVariancesService {
  constructor(
    @InjectRepository(InventoryVarianceCount)
    private countsRepository: Repository<InventoryVarianceCount>,
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
    private dataSource: DataSource,
  ) {}

  private requireOrganization(user: { organizationId?: string }) {
    if (!user.organizationId) {
      throw new ForbiddenException('Organization is required');
    }
    return user.organizationId;
  }

  async getWorksheet(user: { organizationId?: string }) {
    const organizationId = this.requireOrganization(user);

    const products = await this.productsRepository.find({
      where: { organizationId },
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
    const pendingByProduct = new Map(pending.map((count) => [count.productId, count]));

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

  async saveCounts(
    user: { organizationId?: string; id: string },
    items: { productId: string; countedQuantity: number }[],
  ) {
    const organizationId = this.requireOrganization(user);
    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Each product can only be counted once per save');
    }

    const products = await this.productsRepository.find({
      where: { organizationId, id: In(productIds) },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products were not found');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const existing = await this.countsRepository.find({
      where: { organizationId, status: 'PENDING', productId: In(productIds) },
    });
    const existingMap = new Map(existing.map((count) => [count.productId, count]));

    const toSave = items.map((item) => {
      const product = productMap.get(item.productId);
      const systemQuantity = Number(product?.stockQuantity) || 0;
      const current = existingMap.get(item.productId);
      if (current) {
        current.countedQuantity = item.countedQuantity;
        current.countedByUserId = user.id;
        return current;
      }
      return this.countsRepository.create({
        organizationId,
        productId: item.productId,
        countedQuantity: item.countedQuantity,
        systemQuantity,
        status: 'PENDING' as const,
        countedByUserId: user.id,
      });
    });

    await this.countsRepository.save(toSave);
    return this.getWorksheet(user);
  }

  async apply(
    user: { organizationId?: string; id: string },
    productIds?: string[],
  ) {
    const organizationId = this.requireOrganization(user);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const counts = await queryRunner.manager.find(InventoryVarianceCount, {
        where: {
          organizationId,
          status: 'PENDING',
          ...(productIds?.length ? { productId: In(productIds) } : {}),
        },
        order: { productId: 'ASC' },
      });

      if (productIds?.length) {
        const found = new Set(counts.map((count) => count.productId));
        const missing = productIds.filter((id) => !found.has(id));
        if (missing.length > 0) {
          throw new BadRequestException('Save the count before updating stock');
        }
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

      for (const count of counts) {
        const product = await queryRunner.manager.findOne(ProductEntity, {
          where: { id: count.productId, organizationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new NotFoundException('Product not found');
        }

        const previousQuantity = Number(product.stockQuantity) || 0;
        const snapshot = Number(count.systemQuantity) || 0;
        const adjustment = count.countedQuantity - snapshot;
        const nextQuantity = previousQuantity + adjustment;
        if (nextQuantity !== previousQuantity) {
          product.stockQuantity = nextQuantity;
          await queryRunner.manager.save(product);
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
        applied: counts.length,
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

  async remove(id: string, user: { organizationId?: string }) {
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
