import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MicroMediaService } from './micro-media.service';
import { MediaScoreService } from '../media-score/media-score.service';
import { InteractionsV2Service } from './interactions-v2.service';
import {
  AssignAccountDto,
  CreateInlineAccountDto,
  CreateMicroMediaDto,
  CreatePerformanceSnapshotDto,
  MicroMediaListQueryDto,
  SetRepresentativeDto,
  UpdateMicroMediaDto,
} from './micro-media.dto';
import { CreateInteractionV2Dto } from './interactions-v2.dto';
import { CreateScoreRecordDto } from '../media-score/media-score.dto';

/**
 * کنترلر میکرورسانه (`/micro-media`) — واحد مرکزی محصول جدید (design §4).
 * احراز هویت/scope از طریق گاردهای سراسری (AccessModule، flag-gated) اعمال می‌شود.
 */
@Controller('micro-media')
export class MicroMediaController {
  constructor(
    private readonly mediaService: MicroMediaService,
    private readonly scoreService: MediaScoreService,
    private readonly interactions: InteractionsV2Service,
  ) {}

  @Get()
  list(@Query() query: MicroMediaListQueryDto, @Req() req: Request) {
    const scope = (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[] }
      | undefined;
    return this.mediaService.list(query, scope);
  }

  // --- نمایندگان (representatives) ---
  // این مسیرهای ثابت باید پیش از `@Get(':id')` اعلام شوند تا با ParseIntPipe
  // تداخل پیدا نکنند (مثلاً «representatives» به‌عنوان id تفسیر نشود).

  /** همهٔ نمایندگان، گروه‌بندی‌شده بر اساس خوشه و هویت (برای نمایش در جدول). */
  @Get('representatives')
  getRepresentatives() {
    return this.mediaService.getRepresentativesGrouped();
  }

  /** فهرست میکرورسانه‌های یک خوشهٔ موضوعی (برای مدیریت نمایندگان خوشه). */
  @Get('by-cluster/:clusterId')
  listByCluster(@Param('clusterId', ParseIntPipe) clusterId: number) {
    return this.mediaService.listByCluster(clusterId);
  }

  /** فهرست میکرورسانه‌های یک هویت (برای مدیریت نمایندگان هویت). */
  @Get('by-identity')
  listByIdentity(@Query('title') title: string) {
    return this.mediaService.listByIdentity(title);
  }

  @Post()
  create(@Body() dto: CreateMicroMediaDto) {
    return this.mediaService.create(dto);
  }

  @Post('bulk')
  createBulk(@Body() dtos: CreateMicroMediaDto[]) {
    return this.mediaService.createBulk(dtos);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    const media = await this.mediaService.findById(id);
    const tags = await this.mediaService.getTags(id);
    return { ...media, tags };
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMicroMediaDto,
  ) {
    return this.mediaService.update(id, dto);
  }

  /** PATCH /micro-media/:id/representative — تعیین/لغو نماینده (خوشه یا هویت). */
  @Patch(':id/representative')
  setRepresentative(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRepresentativeDto,
  ) {
    return this.mediaService.setRepresentative(id, dto.scope, dto.value);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.deactivate(id);
  }

  // --- tags ---
  @Post(':id/tags')
  setTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { tags: string[] },
  ) {
    return this.mediaService.setTags(id, body.tags ?? []);
  }

  // --- accounts ---
  @Get(':id/accounts')
  listAccounts(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.listAccounts(id);
  }

  @Post(':id/accounts')
  attachAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAccountDto,
  ) {
    return this.mediaService.attachAccount(id, dto);
  }

  @Post(':id/accounts/create')
  createAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInlineAccountDto,
  ) {
    return this.mediaService.createAccount(id, dto);
  }

  @Delete('accounts/:pageId')
  detachAccount(@Param('pageId', ParseIntPipe) pageId: number) {
    return this.mediaService.detachAccount(pageId);
  }

  // --- performance ---
  @Get(':id/performance')
  listPerformance(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.listPerformance(id);
  }

  @Post(':id/performance')
  addPerformance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePerformanceSnapshotDto,
  ) {
    return this.mediaService.createPerformanceSnapshot(id, dto);
  }

  @Post(':id/refresh-performance')
  refreshPerformance(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.refreshPerformanceFromPages(id);
  }

  // --- scores ---
  @Get(':id/scores')
  listScores(@Param('id', ParseIntPipe) id: number) {
    return this.scoreService.listRecordsForMedia(id);
  }

  @Post(':id/scores')
  addScore(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateScoreRecordDto,
  ) {
    return this.scoreService.upsertRecord({ ...dto, micro_media_id: id });
  }

  // --- interactions ---
  @Get(':id/interactions')
  listInteractions(@Param('id', ParseIntPipe) id: number) {
    return this.interactions.listForMedia(id);
  }

  @Post(':id/interactions')
  addInteraction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInteractionV2Dto,
  ) {
    return this.interactions.create({ ...dto, micro_media_id: id });
  }

  // --- content & suggestion (فاز ۴) ---
  @Get(':id/posts')
  listPosts(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.getRecentPosts(id);
  }

  @Post(':id/suggest-profile-from-posts')
  suggestProfile(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.suggestProfileFromPosts(id);
  }
}
