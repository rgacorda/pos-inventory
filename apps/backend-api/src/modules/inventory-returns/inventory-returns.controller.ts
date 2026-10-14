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
import { InventoryReturnsService } from './inventory-returns.service';
import {
  CreateInventoryReturnDto,
  UpdateInventoryReturnDto,
  ResolveInventoryReturnDto,
} from './dto/inventory-return.dto';

@Controller('inventory-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryReturnsController {
  constructor(
    private readonly inventoryReturnsService: InventoryReturnsService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('archived') archived?: string,
  ) {
    const records = await this.inventoryReturnsService.findAll(
      req.user.organizationId,
      {
        status,
        supplierId,
        startDate,
        endDate,
        archived: archived === 'true',
      },
      req.user,
    );
    return this.inventoryReturnsService.annotateDeletedProducts(records);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryReturnsService.getStats(req.user.organizationId, {
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findOne(@Request() req, @Param('id') id: string) {
    const inventoryReturn = await this.inventoryReturnsService.findOne(
      id,
      req.user.organizationId,
    );
    const [annotated] = await this.inventoryReturnsService.annotateDeletedProducts([
      inventoryReturn,
    ]);
    return annotated;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Request() req, @Body() createDto: CreateInventoryReturnDto) {
    return this.inventoryReturnsService.create({
      ...createDto,
      organizationId: req.user.organizationId,
    });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateInventoryReturnDto,
  ) {
    return this.inventoryReturnsService.update(
      id,
      req.user.organizationId,
      updateDto,
      req.user,
    );
  }

  @Put(':id/resolve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async resolve(
    @Request() req,
    @Param('id') id: string,
    @Body() resolveDto: ResolveInventoryReturnDto,
  ) {
    return this.inventoryReturnsService.resolve(
      id,
      req.user.organizationId,
      resolveDto,
    );
  }

  @Put(':id/unresolve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async unresolve(@Request() req, @Param('id') id: string) {
    return this.inventoryReturnsService.unresolve(id, req.user.organizationId);
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async restore(@Request() req, @Param('id') id: string) {
    return this.inventoryReturnsService.restore(id, req.user.organizationId);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async delete(@Request() req, @Param('id') id: string) {
    return this.inventoryReturnsService.delete(id, req.user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async archive(@Request() req, @Param('id') id: string) {
    return this.inventoryReturnsService.archive(
      id,
      req.user.organizationId,
      req.user,
    );
  }
}
