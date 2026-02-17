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
import { TerminalsService } from './terminals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '@pos/shared-types';
import { CreateTerminalDto, UpdateTerminalDto } from './dto';

@Controller('terminals')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async create(
    @Body() createTerminalDto: CreateTerminalDto,
    @CurrentUser() user: any,
  ) {
    return this.terminalsService.create(createTerminalDto, user);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.terminalsService.findAll(user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.terminalsService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateTerminalDto: UpdateTerminalDto,
    @CurrentUser() user: any,
  ) {
    return this.terminalsService.update(id, updateTerminalDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.terminalsService.remove(id, user);
  }

  @Post(':id/sync')
  async sync(@Param('id') id: string, @CurrentUser() user: any) {
    return this.terminalsService.syncTerminal(id, user);
  }

  @Get('check-sync/:terminalId')
  async checkSync(
    @Param('terminalId') terminalId: string,
    @CurrentUser() user: any,
  ) {
    return this.terminalsService.checkSyncRequest(terminalId, user);
  }

  @Post('clear-sync/:terminalId')
  async clearSync(
    @Param('terminalId') terminalId: string,
    @CurrentUser() user: any,
  ) {
    return this.terminalsService.clearSyncRequest(terminalId, user);
  }
}
