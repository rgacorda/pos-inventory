import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { OrganizationEntity } from '../../entities/organization.entity';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private organizationRepository: Repository<OrganizationEntity>,
  ) {}

  async create(createUserDto: CreateUserDto, requestingUser: any) {
    const { email, password, organizationId, role } = createUserDto;

    // Check if email already exists
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Role-based validation
    if (requestingUser.role === UserRole.ADMIN) {
      // Admins can only create users in their own organization
      if (organizationId && organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException(
          'Cannot create users in other organizations',
        );
      }

      // Admins cannot create SUPER_ADMIN or ADMIN users
      if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
        throw new ForbiddenException(
          'Insufficient permissions to create this role',
        );
      }

      // Set organization to admin's organization
      createUserDto.organizationId = requestingUser.organizationId;
    }

    // Check subscription limits (skip for SUPER_ADMIN)
    const targetOrgId = createUserDto.organizationId || requestingUser.organizationId;
    if (targetOrgId && requestingUser.role !== UserRole.SUPER_ADMIN) {
      await this.validateUserLimit(targetOrgId);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  private async validateUserLimit(organizationId: string) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      relations: ['subscription'],
    });

    if (!organization || !organization.subscription) {
      throw new BadRequestException('Organization subscription not found');
    }

    const { maxUsers } = organization.subscription.limits;

    // -1 means unlimited (Enterprise plan)
    if (maxUsers === -1) {
      return;
    }

    // Count existing active users in the organization
    const currentUserCount = await this.usersRepository.count({
      where: { 
        organizationId,
        isActive: true 
      },
    });

    if (currentUserCount >= maxUsers) {
      throw new BadRequestException(
        `User limit reached. Your plan allows ${maxUsers} users. Please upgrade your subscription.`,
      );
    }
  }

  async findAll(requestingUser: any) {
    const query = this.usersRepository.createQueryBuilder('user');

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('user.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    return query.orderBy('user.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, requestingUser: any) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (user.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, requestingUser: any) {
    const user = await this.findOne(id, requestingUser);

    // Hash password if provided
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Admins cannot change role to SUPER_ADMIN or ADMIN
    if (requestingUser.role === UserRole.ADMIN) {
      if (
        updateUserDto.role === UserRole.SUPER_ADMIN ||
        updateUserDto.role === UserRole.ADMIN
      ) {
        throw new ForbiddenException(
          'Insufficient permissions to set this role',
        );
      }
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string, requestingUser: any) {
    const user = await this.findOne(id, requestingUser);

    // Cannot delete yourself
    if (user.id === requestingUser.id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    try {
      await this.usersRepository.remove(user);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        // Handle foreign key constraint violations
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('foreign key constraint') ||
          errorMessage.includes('violates foreign key') ||
          errorMessage.includes('fk_')
        ) {
          throw new BadRequestException(
            'Cannot delete user as they have associated records (orders, transactions, etc.). Please transfer or remove all related records first.',
          );
        }
      }
      throw error;
    }
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }
}
