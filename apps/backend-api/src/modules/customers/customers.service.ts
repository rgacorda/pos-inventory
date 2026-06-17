import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { CustomerEntity } from '../../entities/customer.entity';
import {
  CustomerPointTransactionEntity,
  PointTransactionType,
} from '../../entities/customer-point-transaction.entity';
import { OrganizationEntity } from '../../entities/organization.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(CustomerEntity)
    private customersRepository: Repository<CustomerEntity>,
    @InjectRepository(CustomerPointTransactionEntity)
    private transactionsRepository: Repository<CustomerPointTransactionEntity>,
    @InjectRepository(OrganizationEntity)
    private organizationsRepository: Repository<OrganizationEntity>,
  ) {}

  // ─── Loyalty settings ──────────────────────────────────────────────────────

  async getLoyaltySettings(organizationId: string) {
    const org = await this.organizationsRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return {
      loyaltyExpiryDays: org.settings?.loyaltyExpiryDays ?? null,
    };
  }

  async updateLoyaltySettings(
    organizationId: string,
    loyaltyExpiryDays: number | null,
  ) {
    const org = await this.organizationsRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    if (loyaltyExpiryDays !== null && loyaltyExpiryDays < 1) {
      throw new BadRequestException('Expiry days must be at least 1');
    }

    org.settings = {
      ...(org.settings ?? {}),
      loyaltyExpiryDays: loyaltyExpiryDays,
    };
    await this.organizationsRepository.save(org);
    return { loyaltyExpiryDays };
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

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
    if (!customer) throw new NotFoundException('Customer not found');
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

  // ─── Points expiry ─────────────────────────────────────────────────────────

  /**
   * Process expired points for a single organization (or all orgs if no id given).
   * For each EARN transaction past its expiresAt with no expiredAt stamp:
   *   1. Creates an EXPIRE transaction (so the history is auditable)
   *   2. Decrements the customer's totalPoints
   *   3. Stamps expiredAt on the EARN record so it isn't processed again
   */
  async processExpiredPoints(organizationId?: string): Promise<{
    processed: number;
    pointsExpired: number;
  }> {
    const now = new Date();
    const whereClause: any = {
      type: PointTransactionType.EARN,
      expiredAt: IsNull(),
    };
    if (organizationId) whereClause.organizationId = organizationId;

    const expiredEarns = await this.transactionsRepository.find({
      where: {
        ...whereClause,
        expiresAt: LessThan(now),
      },
    });

    if (expiredEarns.length === 0) return { processed: 0, pointsExpired: 0 };

    let totalExpired = 0;

    for (const tx of expiredEarns) {
      try {
        // Stamp the earn record so it is never re-processed
        await this.transactionsRepository.update(tx.id, { expiredAt: now });

        // Deduct from customer balance (never go below 0)
        const customer = await this.customersRepository.findOne({
          where: { id: tx.customerId },
        });
        if (!customer) continue;

        const deduct = Math.min(tx.points, customer.totalPoints);
        if (deduct > 0) {
          await this.customersRepository.decrement(
            { id: tx.customerId },
            'totalPoints',
            deduct,
          );
        }

        // Create an auditable EXPIRE record
        await this.transactionsRepository.save(
          this.transactionsRepository.create({
            customerId: tx.customerId,
            organizationId: tx.organizationId,
            orderId: tx.orderId,
            type: PointTransactionType.EXPIRE,
            points: deduct,
            description: `${deduct} pts expired (earned on ${tx.createdAt.toLocaleDateString()})`,
          }),
        );

        totalExpired += deduct;
      } catch (err) {
        this.logger.error(`Failed to expire transaction ${tx.id}: ${err}`);
      }
    }

    this.logger.log(
      `Points expiry: processed ${expiredEarns.length} transactions, expired ${totalExpired} pts` +
        (organizationId ? ` for org ${organizationId}` : ' (all orgs)'),
    );

    return { processed: expiredEarns.length, pointsExpired: totalExpired };
  }
}
