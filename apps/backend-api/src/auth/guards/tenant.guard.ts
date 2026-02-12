import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@pos/shared-types';

/**
 * Guard to ensure users can only access data from their own organization
 * Super admins bypass this check
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user, params, body } = context.switchToHttp().getRequest();

    // Super admins can access all organizations
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Users without an organization (shouldn't happen, but safety check)
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to any organization');
    }

    // Check if the requested resource belongs to the user's organization
    const requestedOrgId = params.organizationId || body.organizationId;

    if (requestedOrgId && requestedOrgId !== user.organizationId) {
      throw new ForbiddenException('Access denied to this organization');
    }

    return true;
  }
}
