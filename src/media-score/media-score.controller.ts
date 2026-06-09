import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MediaScoreService } from './media-score.service';
import { Roles } from '../auth/roles.decorator';
import {
  BatchScoreDto,
  CreateIndicatorDto,
  CreateScoreRecordDto,
  UpdateIndicatorDto,
} from './media-score.dto';

/**
 * کنترلر شاخص‌ها (`/media-score-indicators`) و رکوردها (`/media-score-records`)
 * — design §4. مدیریت شاخص‌ها به super_admin محدود است (هنگام enforcement).
 * احراز هویت/نقش از طریق گاردهای سراسری (AccessModule، flag-gated).
 */
@Controller()
export class MediaScoreController {
  constructor(private readonly mediaScoreService: MediaScoreService) {}

  @Get('media-score-indicators')
  listIndicators(@Query('includeInactive') includeInactive?: string) {
    return this.mediaScoreService.listIndicators(includeInactive === 'true');
  }

  @Roles('super_admin', 'admin')
  @Post('media-score-indicators')
  createIndicator(@Body() dto: CreateIndicatorDto) {
    return this.mediaScoreService.createIndicator(dto);
  }

  @Roles('super_admin', 'admin')
  @Patch('media-score-indicators/:id')
  updateIndicator(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIndicatorDto,
  ) {
    return this.mediaScoreService.updateIndicator(id, dto);
  }

  @Post('media-score-records')
  upsertRecord(@Body() dto: CreateScoreRecordDto) {
    return this.mediaScoreService.upsertRecord(dto);
  }

  @Post('media-score-records/batch')
  batchUpsert(@Body() dto: BatchScoreDto) {
    return this.mediaScoreService.batchUpsert(dto);
  }

  @Get('media-score/leaderboard')
  leaderboard(
    @Req() req: Request,
    @Query('indicatorId') indicatorId?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[] }
      | undefined;
    return this.mediaScoreService.leaderboard(
      indicatorId ? Number(indicatorId) : undefined,
      limit ? Number(limit) : undefined,
      scope,
    );
  }

  @Get('media-score/detail/:microMediaId')
  detail(@Param('microMediaId', ParseIntPipe) microMediaId: number) {
    return this.mediaScoreService.mediaScoreDetail(microMediaId);
  }

  @Get('media-score-records')
  listRecords(@Query('microMediaId', ParseIntPipe) microMediaId: number) {
    return this.mediaScoreService.listRecordsForMedia(microMediaId);
  }
}
