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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@pos/shared-types';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

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
