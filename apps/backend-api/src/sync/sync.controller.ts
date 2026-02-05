import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import type { SyncRequestDto, SyncResponseDto } from '@pos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('pos/sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sync(
    @Body() syncRequest: SyncRequestDto,
    @CurrentUser() user: any,
  ): Promise<SyncResponseDto> {
    return this.syncService.processSync(syncRequest, user);
  }
}
