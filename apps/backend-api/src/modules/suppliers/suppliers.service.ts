import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../entities/supplier.entity';
import { SupplierIncentive } from '../../entities/supplier-incentive.entity';
import { CreateSupplierIncentiveDto } from './dto/supplier-incentive.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
    @InjectRepository(SupplierIncentive)
    private supplierIncentivesRepository: Repository<SupplierIncentive>,
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
}
