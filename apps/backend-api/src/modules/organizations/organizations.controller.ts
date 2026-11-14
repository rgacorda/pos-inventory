import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '@pos/shared-types';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateSubscriptionDto } from './dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly subscriptionScheduler: SubscriptionSchedulerService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    const organization = await this.organizationsService.create(createOrganizationDto);
    return this.organizationsService.present(organization);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  async findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    this.organizationsService.assertAccessible(id, user);
    const organization = await this.organizationsService.findOne(id);
    return this.organizationsService.present(organization);
  }

  @Get(':id/stats')
  @Roles(UserRole.SUPER_ADMIN)
  async getStats(@Param('id') id: string) {
    return this.organizationsService.getOrganizationStats(id);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: any,
  ) {
    this.organizationsService.assertAccessible(id, user);
    const organization = await this.organizationsService.update(id, updateOrganizationDto);
    return this.organizationsService.present(organization);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }

  @Post(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  async activate(@Param('id') id: string) {
    return this.organizationsService.toggleActive(id, true);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN)
  async deactivate(@Param('id') id: string) {
    return this.organizationsService.toggleActive(id, false);
  }

  @Put(':id/subscription')
  @Roles(UserRole.SUPER_ADMIN)
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.organizationsService.updateSubscription(
      id,
      updateSubscriptionDto.plan,
      updateSubscriptionDto.status,
      updateSubscriptionDto.periodEndDate ? new Date(updateSubscriptionDto.periodEndDate) : undefined,
    );
  }

  @Post('subscriptions/check-expired')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async checkExpiredSubscriptions() {
    await this.subscriptionScheduler.manualExpireCheck();
    return { message: 'Expiration check completed' };
  }
}
