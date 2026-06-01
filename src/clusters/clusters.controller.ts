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
  Put,
} from '@nestjs/common';
import { ClustersService } from './clusters.service';
import {
  AssignSourcesDto,
  CreateClusterDto,
  SetRepresentativesDto,
  ToggleRepresentativeDto,
  UpdateClusterDto,
} from './clusters.dto';

/**
 * کنترلر خوشه‌ها (ClustersController — design §5.4 / §7.2).
 *
 * **تصمیم مرزی — اجتناب از تداخل مسیر (Requirement 1.6 — گذار غیرتخریبی):**
 * کنترلر legacy `ClusterController` همچنان روی مسیر پایهٔ `/clusters` ثبت است و
 * در دورهٔ گذار باید بدون تغییر کار کند. برای جلوگیری از تداخل مسیر (route
 * collision) با آن، این کنترلر جدید روی فضای‌نام مجزای `/clusters-v2` ثبت
 * می‌شود. به این ترتیب سطح تمیز CRUD + نمایندگان نسخهٔ جدید بدون شکستن مسیرهای
 * `/clusters` موجود در دسترس قرار می‌گیرد.
 *
 * بسته‌بندی Response Envelope توسط ResponseInterceptor سراسری و نگاشت خطا توسط
 * AllExceptionsFilter انجام می‌شود (Requirement 12).
 */
@Controller('clusters-v2')
export class ClustersController {
  constructor(private readonly clustersService: ClustersService) {}

  /** GET /clusters-v2 — فهرست خوشه‌ها به‌همراه آمار سریع. */
  @Get()
  findAll() {
    return this.clustersService.findAll();
  }

  /** GET /clusters-v2/:id — جزئیات یک خوشه به‌همراه منابع عضو. */
  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.clustersService.findById(id);
  }

  /** GET /clusters-v2/:id/sources — فهرست منابع عضو یک خوشه. */
  @Get(':id/sources')
  getSources(@Param('id', ParseIntPipe) id: number) {
    return this.clustersService.getSources(id);
  }

  /** POST /clusters-v2 — ساخت یک خوشهٔ جدید. */
  @Post()
  create(@Body() dto: CreateClusterDto) {
    return this.clustersService.create(dto);
  }

  /** PUT /clusters-v2/:id — به‌روزرسانی یک خوشه. */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClusterDto,
  ) {
    return this.clustersService.update(id, dto);
  }

  /** DELETE /clusters-v2/:id — حذف یک خوشه (منابع از خوشه جدا می‌شوند). */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.clustersService.remove(id);
    return { id, deleted: true };
  }

  /** POST /clusters-v2/:id/sources — افزودن منابع به یک خوشه. */
  @Post(':id/sources')
  assignSources(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignSourcesDto,
  ) {
    return this.clustersService.assignSources(id, dto);
  }

  /** DELETE /clusters-v2/:id/sources — حذف منابع از یک خوشه. */
  @Delete(':id/sources')
  removeSources(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignSourcesDto,
  ) {
    return this.clustersService.removeSources(id, dto);
  }

  /** PUT /clusters-v2/:id/representatives — تعیین مجموعهٔ کامل نمایندگان. */
  @Put(':id/representatives')
  setRepresentatives(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRepresentativesDto,
  ) {
    return this.clustersService.setRepresentatives(id, dto);
  }

  /** PATCH /clusters-v2/:id/sources/:sourceId/representative — تغییر نماینده. */
  @Patch(':id/sources/:sourceId/representative')
  toggleRepresentative(
    @Param('id', ParseIntPipe) id: number,
    @Param('sourceId', ParseIntPipe) sourceId: number,
    @Body() dto: ToggleRepresentativeDto,
  ) {
    return this.clustersService.toggleRepresentative(id, sourceId, dto);
  }
}
