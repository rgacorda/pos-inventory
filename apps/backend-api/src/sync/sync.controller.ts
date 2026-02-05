import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';
import type { SyncRequestDto, SyncResponseDto } from '@pos/shared-types';

@Controller('pos/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sync(@Body() syncRequest: SyncRequestDto): Promise<SyncResponseDto> {
    return this.syncService.processSync(syncRequest);
  }
}
