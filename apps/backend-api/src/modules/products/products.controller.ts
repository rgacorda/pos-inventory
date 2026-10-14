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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '@pos/shared-types';
import { CreateProductDto, UpdateProductDto } from './dto';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.create(createProductDto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('supplierId') supplierId?: string,
    @Query('archived') archived?: string,
  ) {
    return this.productsService.findAll(user, {
      supplierId,
      archived: archived === 'true',
    });
  }

  @Get('barcode/:barcode')
  async findByBarcode(@Param('barcode') barcode: string, @CurrentUser() user: any) {
    return this.productsService.findByBarcode(barcode, user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(id, updateProductDto, user);
  }

  @Post(':id/dismiss-edits')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async dismissEdits(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.dismissEdits(id, user);
  }

  @Post(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.restore(id, user);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.archive(id, user);
  }
}
