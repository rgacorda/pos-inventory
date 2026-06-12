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
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole, OrderStatus } from '@pos/shared-types';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { ExchangeOrderDto } from '@pos/shared-types';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: OrderStatus,
    @Query('terminalId') terminalId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ordersService.findAll(user, {
      status,
      terminalId,
      startDate,
      endDate,
    });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    return this.ordersService.getOrderStats(user);
  }

  @Get('dashboard-stats')
  async getDashboardStats(@CurrentUser() user: any) {
    return this.ordersService.getDashboardStats(user);
  }

  @Get('report-analytics')
  async getReportAnalytics(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.ordersService.getReportAnalytics(user, startDate, endDate);
  }

  @Get('manual-items')
  async getManualItems(@CurrentUser() user: any) {
    return this.ordersService.getManualItems(user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.update(id, updateOrderDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.remove(id, user);
  }

  @Post(':id/sync')
  async sync(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.syncOrder(id, user);
  }

  @Post(':id/void')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async void(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.voidOrder(id, user);
  }

  @Post(':id/exchange')
  async exchange(
    @Param('id') id: string,
    @Body() dto: ExchangeOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.exchangeOrder(id, dto, user);
  }
}
