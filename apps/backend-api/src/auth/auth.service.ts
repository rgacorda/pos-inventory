import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../entities/user.entity';
import { OrganizationEntity } from '../entities/organization.entity';
import type { AuthResponseDto, LoginDto } from '@pos/shared-types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private organizationRepository: Repository<OrganizationEntity>,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
      relations: ['organization'],
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      terminalId: loginDto.terminalId || user.terminalId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name,
      },
    };
  }

  async validateToken(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}
