import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PointsExpiryService } from './points-expiry.service';
import { CustomerEntity } from '../../entities/customer.entity';
import { CustomerPointTransactionEntity } from '../../entities/customer-point-transaction.entity';
import { OrganizationEntity } from '../../entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerEntity,
      CustomerPointTransactionEntity,
      OrganizationEntity,
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService, PointsExpiryService],
  exports: [CustomersService],
})
export class CustomersModule {}
