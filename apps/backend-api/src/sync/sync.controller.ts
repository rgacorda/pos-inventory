import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import type { ProductCatalogPageDto, SyncRequestDto, SyncResponseDto } from '@pos/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('pos/sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('catalog')
  async catalog(
    @Query('cursor') cursor?: string,
    @Query('since') since?: string,
    @Query('asOf') asOf?: string,
    @Query('count') count?: string,
    @Query('stockSum') stockSum?: string,
    @Query('limit') limit?: string,
    @Query('terminalId') terminalId?: string,
    @CurrentUser() user?: any,
  ): Promise<ProductCatalogPageDto> {
    return this.syncService.getCatalogPage(
      {
        cursor: firstQuery(cursor),
        since: firstQuery(since),
        asOf: firstQuery(asOf),
        count: firstQuery(count),
        stockSum: firstQuery(stockSum),
        limit: firstQuery(limit),
        terminalId: firstQuery(terminalId),
      },
      user,
    );
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async sync(
    @Body() syncRequest: SyncRequestDto,
    @CurrentUser() user: any,
  ): Promise<SyncResponseDto> {
    return this.syncService.processSync(syncRequest, user);
  }
}

function firstQuery(value?: string | string[]): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
