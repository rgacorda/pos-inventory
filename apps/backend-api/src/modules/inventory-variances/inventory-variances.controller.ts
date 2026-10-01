import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '@pos/shared-types';
import { InventoryVariancesService } from './inventory-variances.service';
import {
  ApplyInventoryVarianceDto,
  SaveInventoryVarianceDto,
} from './dto/inventory-variance.dto';

@Controller('inventory-variances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryVariancesController {
  constructor(private readonly inventoryVariancesService: InventoryVariancesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  getWorksheet(@CurrentUser() user: any) {
    return this.inventoryVariancesService.getWorksheet(user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  saveCounts(@CurrentUser() user: any, @Body() dto: SaveInventoryVarianceDto) {
    return this.inventoryVariancesService.saveCounts(user, dto.items);
  }

  @Post('apply')
  @Roles(UserRole.ADMIN)
  apply(@CurrentUser() user: any, @Body() dto: ApplyInventoryVarianceDto) {
    return this.inventoryVariancesService.apply(user, dto.productIds);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.inventoryVariancesService.remove(id, user);
  }
}
