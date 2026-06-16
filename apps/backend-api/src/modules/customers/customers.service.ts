import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerEntity } from '../../entities/customer.entity';
import { CustomerPointTransactionEntity, PointTransactionType } from '../../entities/customer-point-transaction.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private customersRepository: Repository<CustomerEntity>,
    @InjectRepository(CustomerPointTransactionEntity)
    private transactionsRepository: Repository<CustomerPointTransactionEntity>,
  ) {}

  async findAll(organizationId: string): Promise<CustomerEntity[]> {
    return this.customersRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<CustomerEntity> {
    const customer = await this.customersRepository.findOne({
      where: { id, organizationId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async lookupByPhone(
    phone: string,
    organizationId: string,
  ): Promise<CustomerEntity | null> {
    return this.customersRepository.findOne({
      where: { phone, organizationId },
    });
  }

  async create(
    dto: CreateCustomerDto,
    organizationId: string,
  ): Promise<CustomerEntity> {
    const existing = await this.lookupByPhone(dto.phone, organizationId);
    if (existing) {
      throw new ConflictException(
        'A customer with this phone number already exists',
      );
    }
    const customer = this.customersRepository.create({
      ...dto,
      organizationId,
      totalPoints: 0,
      totalSpent: 0,
    });
    return this.customersRepository.save(customer);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerEntity> {
    const customer = await this.findOne(id, organizationId);
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.lookupByPhone(dto.phone, organizationId);
      if (existing) {
        throw new ConflictException(
          'A customer with this phone number already exists',
        );
      }
    }
    Object.assign(customer, dto);
    return this.customersRepository.save(customer);
  }

  async getTransactions(
    customerId: string,
    organizationId: string,
  ): Promise<CustomerPointTransactionEntity[]> {
    await this.findOne(customerId, organizationId);
    return this.transactionsRepository.find({
      where: { customerId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }
}
