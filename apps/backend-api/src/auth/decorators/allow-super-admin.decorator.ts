import { SetMetadata } from '@nestjs/common';

export const ALLOW_SUPER_ADMIN_KEY = 'allowSuperAdmin';

/** Routes the super admin portal is allowed to call. Store routes omit this. */
export const AllowSuperAdmin = () => SetMetadata(ALLOW_SUPER_ADMIN_KEY, true);
