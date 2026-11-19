import {
  ForbiddenException,
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { isObservable, lastValueFrom } from 'rxjs';
import { UserRole } from '@pos/shared-types';
import { ALLOW_SUPER_ADMIN_KEY } from '../decorators/allow-super-admin.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);
    const allowed = isObservable(result)
      ? await lastValueFrom(result)
      : await result;
    if (!allowed) return false;

    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== UserRole.SUPER_ADMIN) return true;

    const portalRoute = this.reflector.getAllAndOverride<boolean>(
      ALLOW_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!portalRoute) {
      throw new ForbiddenException(
        'This account can only use the super admin portal',
      );
    }
    return true;
  }
}
