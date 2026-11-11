import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { Expense } from '../../entities/expense.entity';
import { ProductEntity } from '../../entities/product.entity';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      InventoryDelivery,
      Expense,
      ProductEntity,
    ]),
  ],
  controllers: [FinancialsController],
  providers: [FinancialsService],
  exports: [FinancialsService],
})
export class FinancialsModule {}
