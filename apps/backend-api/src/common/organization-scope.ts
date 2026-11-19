import { ForbiddenException } from '@nestjs/common';

/** The signed-in store. A platform account has none, so it cannot read store data. */
export function requireOrganizationId(user: {
  organizationId?: string | null;
}): string {
  if (!user?.organizationId) {
    throw new ForbiddenException('Organization required');
  }
  return user.organizationId;
}
