import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomersService } from './customers.service';

@Injectable()
export class PointsExpiryService {
  private readonly logger = new Logger(PointsExpiryService.name);

  constructor(private readonly customersService: CustomersService) {}

  /** Run every day at 01:00 to expire stale points across all organizations. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyExpiry() {
    this.logger.log('Running daily points expiry job...');
    const result = await this.customersService.processExpiredPoints();
    this.logger.log(
      `Daily expiry complete: ${result.processed} transactions processed, ${result.pointsExpired} pts expired`,
    );
  }

  /** Manual trigger — called from the controller for on-demand expiry runs. */
  async runNow(organizationId?: string) {
    return this.customersService.processExpiredPoints(organizationId);
  }
}
