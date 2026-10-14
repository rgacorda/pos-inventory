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
    @Query('archived') archived?: string,
  ) {
    const deliveries = await this.inventoryDeliveriesService.findAll(
      req.user.organizationId,
      {
        startDate,
        endDate,
        status,
        archived: archived === 'true',
      },
      req.user,
    );
    return this.inventoryDeliveriesService.annotateDeletedProducts(deliveries);
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
    const delivery = await this.inventoryDeliveriesService.findOne(
      id,
      req.user.organizationId,
    );
    const [annotated] = await this.inventoryDeliveriesService.annotateDeletedProducts([
      delivery,
    ]);
    return annotated;
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
      req.user,
    );
  }

  @Post(':id/dismiss-edits')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async dismissEdits(@Request() req, @Param('id') id: string) {
    return this.inventoryDeliveriesService.dismissEdits(
      id,
      req.user.organizationId,
      req.user,
    );
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async restore(@Request() req, @Param('id') id: string) {
    return this.inventoryDeliveriesService.restore(id, req.user.organizationId);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async delete(@Request() req, @Param('id') id: string) {
    return this.inventoryDeliveriesService.delete(id, req.user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async archive(@Request() req, @Param('id') id: string) {
    return this.inventoryDeliveriesService.archive(
      id,
      req.user.organizationId,
      req.user,
    );
  }
}
