import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, DataSource } from 'typeorm';
import { CustomerEntity } from '../../entities/customer.entity';
import {
  CustomerPointTransactionEntity,
  PointTransactionType,
} from '../../entities/customer-point-transaction.entity';
import { OrganizationEntity } from '../../entities/organization.entity';
import { UserEntity } from '../../entities/user.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import * as bcrypt from 'bcrypt';

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
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
    private dataSource: DataSource,
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

  async searchByName(
    q: string,
    organizationId: string,
    limit = 20,
  ): Promise<CustomerEntity[]> {
    return this.customersRepository
      .createQueryBuilder('c')
      .where('c."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('LOWER(c.name) LIKE :q', { q: `%${q.toLowerCase()}%` })
      .orderBy('c.name', 'ASC')
      .limit(limit)
      .getMany();
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

  // ─── Raffle / Points reset ─────────────────────────────────────────────────

  /**
   * Resets all customer points to 0 for an organization.
   * Requires the requesting user's current password as confirmation.
   * Creates an auditable EXPIRE record per customer and stamps all
   * unprocessed EARN transactions with expiredAt so nothing double-processes.
   */
  async resetAllPoints(
    organizationId: string,
    userId: string,
    password: string,
    reason: string = 'Raffle point reset',
  ): Promise<{ customersReset: number; pointsCleared: number }> {
    // Verify the requesting user's password
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Incorrect password');
    }

    // Find all customers with points > 0
    const customers = await this.customersRepository.find({
      where: { organizationId },
    });

    const affected = customers.filter((c) => c.totalPoints > 0);
    if (affected.length === 0) {
      return { customersReset: 0, pointsCleared: 0 };
    }

    const totalPointsCleared = affected.reduce(
      (sum, c) => sum + c.totalPoints,
      0,
    );
    const now = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create one EXPIRE audit record per affected customer
      const expireRecords = affected.map((c) =>
        this.transactionsRepository.create({
          customerId: c.id,
          organizationId,
          type: PointTransactionType.EXPIRE,
          points: c.totalPoints,
          description: `${c.totalPoints} pts cleared — ${reason} (${now.toLocaleDateString()})`,
        }),
      );
      await queryRunner.manager.save(CustomerPointTransactionEntity, expireRecords);

      // 2. Zero out all balances in bulk
      await queryRunner.manager
        .createQueryBuilder()
        .update(CustomerEntity)
        .set({ totalPoints: 0 })
        .where('"organizationId" = :orgId AND "totalPoints" > 0', {
          orgId: organizationId,
        })
        .execute();

      // 3. Stamp all unprocessed EARN transactions so the cron never re-processes them
      await queryRunner.manager
        .createQueryBuilder()
        .update(CustomerPointTransactionEntity)
        .set({ expiredAt: now })
        .where(
          '"organizationId" = :orgId AND type = :type AND "expiredAt" IS NULL',
          { orgId: organizationId, type: PointTransactionType.EARN },
        )
        .execute();

      await queryRunner.commitTransaction();

      this.logger.log(
        `Points reset by user ${userId}: ${affected.length} customers, ${totalPointsCleared} pts cleared (${reason})`,
      );

      return {
        customersReset: affected.length,
        pointsCleared: totalPointsCleared,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
