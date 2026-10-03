import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../entities/user.entity';
import { OrganizationEntity } from '../entities/organization.entity';
import { UserRole, type AuthResponseDto, type LoginDto } from '@pos/shared-types';

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
      relations: ['organization', 'organization.subscription'],
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // SUPER_ADMIN users don't belong to an organization, skip org checks
    if (user.role === 'SUPER_ADMIN') {
      return user;
    }

    // Check if organization is active (for non-super-admin users)
    if (!user.organization?.isActive) {
      return null;
    }

    // Check if subscription is valid (not expired or cancelled)
    if (user.organization.subscription) {
      const subscription = user.organization.subscription;
      const invalidStatuses = ['EXPIRED', 'CANCELLED'];
      
      if (invalidStatuses.includes(subscription.status)) {
        return null;
      }
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials or subscription expired');
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const accessToken = this.signAccessToken(
      user,
      loginDto.terminalId || user.terminalId,
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name,
        mustChangePassword: user.mustChangePassword,
      },
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.name,
        address: user.organization.address,
        phone: user.organization.phone,
        email: user.organization.email,
      } : undefined,
    };
  }

  async validateToken(userId: string, tokenVersion = 0): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if ((user.tokenVersion ?? 0) !== tokenVersion) {
      throw new UnauthorizedException('Session ended');
    }

    return user;
  }

  /**
   * Ends every active session in scope. The caller receives a new token so
   * this browser stays signed in; POS, Inventory, and Super Admin reject the
   * older tokens.
   */
  async logoutAll(requestingUser: {
    id: string;
    role: string;
    organizationId?: string | null;
  }): Promise<{ message: string; accessToken: string }> {
    const update = this.userRepository
      .createQueryBuilder()
      .update(UserEntity)
      .set({ tokenVersion: () => '"tokenVersion" + 1' });

    if (requestingUser.role === UserRole.SUPER_ADMIN) {
      await update.where('1 = 1').execute();
    } else {
      if (!requestingUser.organizationId) {
        throw new ForbiddenException('Organization required');
      }
      await update
        .where('"organizationId" = :organizationId', {
          organizationId: requestingUser.organizationId,
        })
        .execute();
    }

    const user = await this.userRepository.findOne({
      where: { id: requestingUser.id, isActive: true },
      relations: ['organization'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const message =
      requestingUser.role === UserRole.SUPER_ADMIN
        ? 'Signed out every user on all apps'
        : 'Signed out every user in your organization';

    return {
      message,
      accessToken: this.signAccessToken(user, user.terminalId),
    };
  }

  private signAccessToken(user: UserEntity, terminalId?: string) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      terminalId,
      tokenVersion: user.tokenVersion ?? 0,
    });
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If user must change password (first login), current password is not required
    if (!user.mustChangePassword && currentPassword) {
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    // Hash and update password
    user.password = await this.hashPassword(newPassword);
    user.mustChangePassword = false; // Clear the flag after password change

    await this.userRepository.save(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists or not for security
      return;
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = this.generateResetToken();
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.userRepository.save(user);

    // TODO: Send password reset email
    console.log(`[Password Reset] Token for ${email}: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!user || !user.passwordResetExpires) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (new Date() > user.passwordResetExpires) {
      throw new UnauthorizedException('Reset token has expired');
    }

    // Hash and update password
    user.password = await this.hashPassword(newPassword);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.mustChangePassword = false;

    await this.userRepository.save(user);
  }

  private generateResetToken(): string {
    // Generate a random 32-character token
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return token;
  }
}
