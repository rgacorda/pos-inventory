import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryReturn } from '../../entities/inventory-return.entity';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { InventoryReturnsController } from './inventory-returns.controller';
import { InventoryReturnsService } from './inventory-returns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryReturn,
      ProductEntity,
      Supplier,
      InventoryDelivery,
    ]),
  ],
  controllers: [InventoryReturnsController],
  providers: [InventoryReturnsService],
  exports: [InventoryReturnsService],
})
export class InventoryReturnsModule {}
