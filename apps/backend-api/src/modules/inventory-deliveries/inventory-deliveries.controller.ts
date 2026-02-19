import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@pos/shared-types';
import { InventoryDeliveriesService } from './inventory-deliveries.service';

@Controller('inventory-deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryDeliveriesController {
  constructor(
    private readonly inventoryDeliveriesService: InventoryDeliveriesService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.inventoryDeliveriesService.findAll(req.user.organizationId, {
      startDate,
      endDate,
      status,
    });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryDeliveriesService.getStats(req.user.organizationId, {
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findOne(@Request() req, @Param('id') id: string) {
    return this.inventoryDeliveriesService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Request() req, @Body() createDto: any) {
    return this.inventoryDeliveriesService.create({
      ...createDto,
      organizationId: req.user.organizationId,
    });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: any,
  ) {
    return this.inventoryDeliveriesService.update(
      id,
      req.user.organizationId,
      updateDto,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Request() req, @Param('id') id: string) {
    return this.inventoryDeliveriesService.delete(id, req.user.organizationId);
  }
}
