import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';

@Injectable()
export class InventoryDeliveriesService {
  constructor(
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
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

  async create(createDto: any) {
    const delivery = this.deliveryRepository.create(createDto);
    return this.deliveryRepository.save(delivery);
  }

  async update(id: string, organizationId: string, updateDto: any) {
    const delivery = await this.findOne(id, organizationId);
    Object.assign(delivery, updateDto);
    return this.deliveryRepository.save(delivery);
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
