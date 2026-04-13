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
import { TerminalEntity } from '../../entities/terminal.entity';
import { ProductEntity } from '../../entities/product.entity';
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
    @InjectRepository(TerminalEntity)
    private terminalsRepository: Repository<TerminalEntity>,
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const {
      name,
      email,
      plan = SubscriptionPlan.FREE,
      adminName,
      adminEmail,
      adminPassword,
      slug: providedSlug,
      ...orgData
    } = createOrganizationDto;

    // Check if admin email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Use provided slug or generate from name
    const slug = providedSlug || this.generateSlug(name);

    // Check if slug already exists
    const existing = await this.organizationsRepository.findOne({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        providedSlug 
          ? 'Organization with this slug already exists'
          : 'Organization with this name already exists'
      );
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

    // Create subscription with INACTIVE status (manual payment required)
    const subscription = this.subscriptionsRepository.create({
      organizationId: savedOrg.id,
      plan,
      status: SubscriptionStatus.ACTIVE, // Start as ACTIVE by default
      limits: this.getLimitsForPlan(plan),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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

    // If slug is being updated, check for conflicts
    if (updateOrganizationDto.slug && updateOrganizationDto.slug !== organization.slug) {
      const existing = await this.organizationsRepository.findOne({
        where: { slug: updateOrganizationDto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Organization with this slug already exists');
      }
    }

    // If name is being updated but no slug provided, auto-generate slug
    if (updateOrganizationDto.name && !updateOrganizationDto.slug) {
      const autoSlug = this.generateSlug(updateOrganizationDto.name);
      if (autoSlug !== organization.slug) {
        const existing = await this.organizationsRepository.findOne({
          where: { slug: autoSlug },
        });
        if (!existing || existing.id === id) {
          updateOrganizationDto.slug = autoSlug;
        }
        // If auto-generated slug conflicts, keep the existing slug
      }
    }

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

  async updateSubscription(
    organizationId: string,
    plan: SubscriptionPlan,
    status: SubscriptionStatus,
    periodEndDate?: Date,
  ) {
    const organization = await this.findOne(organizationId);

    if (!organization.subscription) {
      throw new NotFoundException('Subscription not found for this organization');
    }

    // Update subscription details
    organization.subscription.plan = plan;
    organization.subscription.status = status;
    organization.subscription.limits = this.getLimitsForPlan(plan);

    // Update period dates if provided
    if (periodEndDate) {
      organization.subscription.currentPeriodEnd = periodEndDate;
    }

    // Update organization features based on plan
    if (organization.settings) {
      organization.settings.features = {
        ...organization.settings.features,
        multipleTerminals: plan !== SubscriptionPlan.FREE,
        api: plan === SubscriptionPlan.ENTERPRISE,
      };
    }

    await this.subscriptionsRepository.save(organization.subscription);
    await this.organizationsRepository.save(organization);

    return this.findOne(organizationId);
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

  async getOrganizationStats(organizationId: string) {
    const organization = await this.findOne(organizationId);

    // Get users with their details
    const users = await this.usersRepository.find({
      where: { organizationId },
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt', 'lastLoginAt'],
      order: { createdAt: 'DESC' },
    });

    // Get counts
    const userCount = await this.usersRepository.count({
      where: { organizationId, isActive: true },
    });

    const terminalCount = await this.terminalsRepository.count({
      where: { organizationId, isActive: true },
    });

    const productCount = await this.productsRepository.count({
      where: { organizationId },
    });

    return {
      organization,
      users,
      stats: {
        userCount,
        terminalCount,
        productCount,
      },
    };
  }
}
