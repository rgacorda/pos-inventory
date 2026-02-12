import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
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

    await this.usersRepository.remove(user);
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }
}
