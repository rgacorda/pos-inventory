import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@pos/shared-types';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
