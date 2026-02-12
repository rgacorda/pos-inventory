import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationEntity } from '../../entities/organization.entity';
import { SubscriptionEntity } from '../../entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntity, SubscriptionEntity])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
