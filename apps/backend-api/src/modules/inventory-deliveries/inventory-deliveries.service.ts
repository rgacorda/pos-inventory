import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { ProductEntity } from '../../entities/product.entity';

@Injectable()
export class InventoryDeliveriesService {
  constructor(
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

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
      );
    }

    return updatedDelivery;
  }

  private async updateProductStock(
    items: Array<{ productId: string; quantity: number }>,
    organizationId: string,
  ) {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, organizationId },
      });

      if (product) {
        product.stockQuantity += item.quantity;
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

    const totalCost = deliveries
      .filter((d) => d.status === 'RECEIVED')
      .reduce((sum, d) => sum + Number(d.totalCost), 0);

    const totalDeliveries = deliveries.length;
    const receivedDeliveries = deliveries.filter(
      (d) => d.status === 'RECEIVED',
    ).length;
    const pendingDeliveries = deliveries.filter(
      (d) => d.status === 'PENDING',
    ).length;

    return {
      totalCost,
      totalDeliveries,
      receivedDeliveries,
      pendingDeliveries,
    };
  }
}
