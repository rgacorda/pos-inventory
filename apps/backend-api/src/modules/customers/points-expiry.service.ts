import { Injectable, Logger } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Injectable()
export class PointsExpiryService {
  private readonly logger = new Logger(PointsExpiryService.name);

  constructor(private readonly customersService: CustomersService) {}

  // Daily cron intentionally disabled — points no longer expire automatically.
  // Points are reset manually via the "Reset All Points (Raffle)" action.

  /** Manual trigger — kept for on-demand use from the admin controller. */
  async runNow(organizationId?: string) {
    return this.customersService.processExpiredPoints(organizationId);
  }
}
