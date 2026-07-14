import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { ProductEntity } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { InventoryDeliveriesController } from './inventory-deliveries.controller';
import { InventoryDeliveriesService } from './inventory-deliveries.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryDelivery, ProductEntity, Supplier]),
  ],
  controllers: [InventoryDeliveriesController],
  providers: [InventoryDeliveriesService],
  exports: [InventoryDeliveriesService],
})
export class InventoryDeliveriesModule {}
