import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@pos/shared-types';
import { FinancialsService } from './financials.service';

@Controller('financials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  @Get('profit-loss')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getProfitLoss(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialsService.calculateProfitLoss(
      req.user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getSummary(@Request() req) {
    return this.financialsService.getFinancialSummary(req.user.organizationId);
  }
}
