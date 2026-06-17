import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@pos/shared-types';
import { CustomersService } from './customers.service';
import { PointsExpiryService } from './points-expiry.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateLoyaltySettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  loyaltyExpiryDays: number | null;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly pointsExpiryService: PointsExpiryService,
  ) {}

  // ── Loyalty settings ──────────────────────────────────────────────────────

  @Get('loyalty-settings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getLoyaltySettings(@Request() req) {
    return this.customersService.getLoyaltySettings(req.user.organizationId);
  }

  @Put('loyalty-settings')
  @Roles(UserRole.ADMIN)
  async updateLoyaltySettings(
    @Request() req,
    @Body() dto: UpdateLoyaltySettingsDto,
  ) {
    return this.customersService.updateLoyaltySettings(
      req.user.organizationId,
      dto.loyaltyExpiryDays,
    );
  }

  @Post('loyalty-settings/expire-now')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async runExpiryNow(@Request() req) {
    return this.pointsExpiryService.runNow(req.user.organizationId);
  }

  // ── Customers ─────────────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findAll(@Request() req) {
    return this.customersService.findAll(req.user.organizationId);
  }

  @Get('lookup')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async lookup(@Request() req, @Query('phone') phone: string) {
    const customer = await this.customersService.lookupByPhone(
      phone,
      req.user.organizationId,
    );
    return customer ?? null;
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findOne(@Request() req, @Param('id') id: string) {
    return this.customersService.findOne(id, req.user.organizationId);
  }

  @Get(':id/transactions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async getTransactions(@Request() req, @Param('id') id: string) {
    return this.customersService.getTransactions(
      id,
      req.user.organizationId,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async create(@Request() req, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto, req.user.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, req.user.organizationId, dto);
  }
}
