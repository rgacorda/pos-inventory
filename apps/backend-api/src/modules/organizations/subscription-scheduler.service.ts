import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SubscriptionEntity } from '../../entities/subscription.entity';
import { SubscriptionStatus } from '@pos/shared-types';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private subscriptionRepository: Repository<SubscriptionEntity>,
  ) {}

  /**
   * Runs daily at 2 AM to check for expired subscriptions
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkExpiredSubscriptions() {
    this.logger.log('Checking for expired subscriptions...');

    try {
      const now = new Date();

      // Find all subscriptions that have passed their end date and are not already expired/cancelled
      const result = await this.subscriptionRepository
        .createQueryBuilder()
        .update(SubscriptionEntity)
        .set({ status: SubscriptionStatus.EXPIRED })
        .where('currentPeriodEnd < :now', { now })
        .andWhere('status NOT IN (:...statuses)', {
          statuses: [SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED],
        })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Marked ${result.affected} subscription(s) as EXPIRED`);
      } else {
        this.logger.log('No expired subscriptions found');
      }
    } catch (error) {
      this.logger.error('Error checking expired subscriptions:', error);
    }
  }

  /**
   * Manual method to check and expire subscriptions (useful for testing)
   */
  async manualExpireCheck() {
    this.logger.log('Manual expiration check triggered');
    await this.checkExpiredSubscriptions();
  }
}
