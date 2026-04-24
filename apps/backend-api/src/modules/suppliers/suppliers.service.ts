import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
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
}
