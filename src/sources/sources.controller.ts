import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SourcesService } from './sources.service';
import {
  AnalysisHistoryQuery,
  AnalyzeSourceDto,
  AssignClusterDto,
  BulkCreateSourceDto,
  CreateSourceDto,
  SetRepresentativeDto,
  SetStatusDto,
  SourceListQuery,
  UpdateSourceDto,
} from './sources.dto';
import { SourceStatus } from './source.types';
import { Timeframe } from './sources.delegation';

/**
 * کنترلر منابع (SourcesController — design §7.2).
 *
 * بسته‌بندی Response Envelope توسط ResponseInterceptor
 * سراسری و نگاشت خطا توسط AllExceptionsFilter انجام می‌شود (Requirement 12).
 * علاوه بر هستهٔ CRUD + صفحه‌بندی، مسیرهای عملیات سنگین
 * (`fetch`/`analyze`/`insight`) و تاریخچهٔ تحلیل (`analysis-history`) نیز اینجا
 * تعریف شده‌اند؛ این مسیرها صرفاً به `SourcesService` (که خود به
 * Collection/Analysis واگذار می‌کند) فراخوانی می‌کنند (Requirement 2.7, 2.8).
 */
@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  /** GET /sources — فهرست صفحه‌بندی‌شدهٔ منابع با فیلترهای اختیاری. */
  @Get()
  findPaginated(@Query() query: SourceListQuery) {
    return this.sourcesService.findPaginated(query);
  }

  /** GET /sources/:id/analysis-history — تاریخچهٔ صفحه‌بندی‌شدهٔ تحلیل منبع. */
  @Get(':id/analysis-history')
  getAnalysisHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AnalysisHistoryQuery,
  ) {
    return this.sourcesService.getAnalysisHistory(id, query);
  }

  /** GET /sources/:id — جزئیات یک منبع. */
  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.sourcesService.findById(id);
  }

  /** POST /sources — ساخت یک منبع جدید. */
  @Post()
  create(@Body() dto: CreateSourceDto) {
    return this.sourcesService.create(dto);
  }

  /** POST /sources/bulk — واردات گروهی با گزارش created/skipped. */
  @Post('bulk')
  bulkCreate(@Body() dto: BulkCreateSourceDto) {
    return this.sourcesService.bulkCreate(dto);
  }

  /** PATCH /sources/:id — به‌روزرسانی فیلدهای پروفایلی منبع. */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSourceDto,
  ) {
    return this.sourcesService.update(id, dto);
  }

  /** DELETE /sources/:id — حذف منبع. */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sourcesService.remove(id);
    return { id, deleted: true };
  }

  /** PATCH /sources/:id/representative — تنظیم پرچم نماینده. */
  @Patch(':id/representative')
  setRepresentative(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRepresentativeDto,
  ) {
    return this.sourcesService.setRepresentative(id, dto.value);
  }

  /** PATCH /sources/:id/cluster — اختصاص/حذف اختصاص خوشه. */
  @Patch(':id/cluster')
  assignCluster(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignClusterDto,
  ) {
    return this.sourcesService.assignCluster(id, dto.clusterId ?? null);
  }

  /** PATCH /sources/:id/status — تغییر وضعیت فعال/غیرفعال. */
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetStatusDto,
  ) {
    return this.sourcesService.setStatus(id, dto.status as SourceStatus);
  }

  /**
   * POST /sources/:id/fetch — واکشی محتوای منبع.
   * صرفاً delegate به CollectionService (Requirement 2.7)؛ بدون fetch در این لایه.
   */
  @Post(':id/fetch')
  @HttpCode(HttpStatus.OK)
  fetch(@Param('id', ParseIntPipe) id: number) {
    return this.sourcesService.fetch(id);
  }

  /**
   * POST /sources/:id/analyze — تحلیل محتوای منبع در یک بازهٔ زمانی.
   * صرفاً delegate به AnalysisService (Requirement 2.7)؛ بدون LLM در این لایه.
   */
  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  analyze(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnalyzeSourceDto,
  ) {
    return this.sourcesService.analyze(
      id,
      (dto.timeframe ?? 'all') as Timeframe,
    );
  }

  /**
   * POST /sources/:id/insight — تولید بینش منبع.
   * صرفاً delegate به AnalysisService (Requirement 2.7)؛ بدون LLM در این لایه.
   */
  @Post(':id/insight')
  @HttpCode(HttpStatus.OK)
  insight(@Param('id', ParseIntPipe) id: number) {
    return this.sourcesService.insight(id);
  }
}
