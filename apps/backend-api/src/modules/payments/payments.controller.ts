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
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole, PaymentStatus } from '@pos/shared-types';
import { CreatePaymentDto, UpdatePaymentDto, RefundPaymentDto } from './dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.create(createPaymentDto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('orderId') orderId?: string,
    @Query('terminalId') terminalId?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.findAll(user, { orderId, terminalId, status });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    return this.paymentsService.getPaymentStats(user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.update(id, updatePaymentDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.remove(id, user);
  }

  @Post(':id/refund')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async refund(
    @Param('id') id: string,
    @Body() refundDto: RefundPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.refund(id, refundDto, user);
  }
}
