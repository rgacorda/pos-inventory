import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { ProductEntity } from '../../entities/product.entity';
import { InventoryDeliveriesController } from './inventory-deliveries.controller';
import { InventoryDeliveriesService } from './inventory-deliveries.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryDelivery, ProductEntity])],
  controllers: [InventoryDeliveriesController],
  providers: [InventoryDeliveriesService],
  exports: [InventoryDeliveriesService],
})
export class InventoryDeliveriesModule {}
