import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerEntity } from '../../entities/customer.entity';
import { CustomerPointTransactionEntity } from '../../entities/customer-point-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerEntity, CustomerPointTransactionEntity]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
