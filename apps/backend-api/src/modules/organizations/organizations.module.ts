import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { OrganizationEntity } from '../../entities/organization.entity';
import { SubscriptionEntity } from '../../entities/subscription.entity';
import { UserEntity } from '../../entities/user.entity';
import { TerminalEntity } from '../../entities/terminal.entity';
import { ProductEntity } from '../../entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntity, SubscriptionEntity, UserEntity, TerminalEntity, ProductEntity])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, SubscriptionSchedulerService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
