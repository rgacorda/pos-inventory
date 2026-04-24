import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@pos/shared-types';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(@Request() req) {
    return this.suppliersService.findAll(req.user.organizationId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findOne(@Request() req, @Param('id') id: string) {
    return this.suppliersService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Request() req, @Body() createDto: CreateSupplierDto) {
    return this.suppliersService.create({
      ...createDto,
      organizationId: req.user.organizationId,
    });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, req.user.organizationId, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Request() req, @Param('id') id: string) {
    return this.suppliersService.delete(id, req.user.organizationId);
  }
}
