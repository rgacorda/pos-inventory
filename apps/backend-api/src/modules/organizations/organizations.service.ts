import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../../entities/organization.entity';
import { SubscriptionEntity } from '../../entities/subscription.entity';
import { UserEntity } from '../../entities/user.entity';
import { SubscriptionPlan, SubscriptionStatus, UserRole } from '@pos/shared-types';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(SubscriptionEntity)
    private subscriptionsRepository: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const {
      name,
      email,
      plan = SubscriptionPlan.FREE,
      adminName,
      adminEmail,
      adminPassword,
      ...orgData
    } = createOrganizationDto;

    // Check if admin email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate slug from name
    const slug = this.generateSlug(name);

    // Check if slug already exists
    const existing = await this.organizationsRepository.findOne({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Organization with this name already exists');
    }

    // Generate temporary password if not provided
    const tempPassword = adminPassword || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create organization
    const organization = this.organizationsRepository.create({
      name,
      slug,
      email,
      ...orgData,
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        language: 'en',
        taxRate: 0,
        features: {
          inventory: true,
          multipleTerminals: plan !== SubscriptionPlan.FREE,
          reporting: true,
          api: plan === SubscriptionPlan.ENTERPRISE,
        },
      },
    });

    const savedOrg = await this.organizationsRepository.save(organization);

    // Create subscription
    const subscription = this.subscriptionsRepository.create({
      organizationId: savedOrg.id,
      plan,
      status: SubscriptionStatus.TRIAL,
      limits: this.getLimitsForPlan(plan),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
    });

    await this.subscriptionsRepository.save(subscription);

    // Create admin user for the organization
    const adminUser = this.usersRepository.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
      organizationId: savedOrg.id,
      isActive: true,
      mustChangePassword: true, // Force password change on first login
    });

    await this.usersRepository.save(adminUser);

    // TODO: Send email notification with credentials
    // For now, we'll return the temp password in the response (remove in production)
    console.log(`[Organization Created] Admin credentials:`, {
      email: adminEmail,
      temporaryPassword: tempPassword,
      organizationId: savedOrg.id,
    });

    return this.findOne(savedOrg.id);
  }

  async findAll() {
    return this.organizationsRepository.find({
      relations: ['subscription'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const organization = await this.organizationsRepository.findOne({
      where: { id },
      relations: ['subscription', 'users', 'terminals'],
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const organization = await this.findOne(id);

    Object.assign(organization, updateOrganizationDto);

    return this.organizationsRepository.save(organization);
  }

  async remove(id: string) {
    const organization = await this.findOne(id);

    // Check if organization has users
    if (organization.users && organization.users.length > 0) {
      throw new BadRequestException(
        'Cannot delete organization with active users. Please remove all users first.',
      );
    }

    await this.organizationsRepository.remove(organization);
  }

  async toggleActive(id: string, isActive: boolean) {
    const organization = await this.findOne(id);
    organization.isActive = isActive;
    return this.organizationsRepository.save(organization);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private generateTemporaryPassword(): string {
    // Generate a random 12-character password
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  private getLimitsForPlan(plan: SubscriptionPlan) {
    const limits = {
      [SubscriptionPlan.FREE]: {
        maxUsers: 2,
        maxTerminals: 1,
        maxProducts: 100,
        maxTransactionsPerMonth: 500,
        features: {
          multipleLocations: false,
          advancedReporting: false,
          apiAccess: false,
          prioritySupport: false,
        },
      },
      [SubscriptionPlan.BASIC]: {
        maxUsers: 5,
        maxTerminals: 2,
        maxProducts: 1000,
        maxTransactionsPerMonth: 5000,
        features: {
          multipleLocations: false,
          advancedReporting: true,
          apiAccess: false,
          prioritySupport: false,
        },
      },
      [SubscriptionPlan.PROFESSIONAL]: {
        maxUsers: 20,
        maxTerminals: 10,
        maxProducts: 10000,
        maxTransactionsPerMonth: 50000,
        features: {
          multipleLocations: true,
          advancedReporting: true,
          apiAccess: true,
          prioritySupport: false,
        },
      },
      [SubscriptionPlan.ENTERPRISE]: {
        maxUsers: -1, // unlimited
        maxTerminals: -1,
        maxProducts: -1,
        maxTransactionsPerMonth: -1,
        features: {
          multipleLocations: true,
          advancedReporting: true,
          apiAccess: true,
          prioritySupport: true,
        },
      },
    };

    return limits[plan];
  }
}
