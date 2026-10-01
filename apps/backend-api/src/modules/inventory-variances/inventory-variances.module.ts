import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryVarianceCount } from '../../entities/inventory-variance-count.entity';
import { ProductEntity } from '../../entities/product.entity';
import { UserEntity } from '../../entities/user.entity';
import { InventoryVariancesController } from './inventory-variances.controller';
import { InventoryVariancesService } from './inventory-variances.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryVarianceCount,
      ProductEntity,
      UserEntity,
    ]),
  ],
  controllers: [InventoryVariancesController],
  providers: [InventoryVariancesService],
  exports: [InventoryVariancesService],
})
export class InventoryVariancesModule {}
