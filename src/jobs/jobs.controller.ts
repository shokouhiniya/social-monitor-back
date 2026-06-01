import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { JobService } from './jobs.service';
import { JobWorker } from './job.worker';
import { JobQuery, RefreshJobDto } from './jobs.dto';

/**
 * JobsController — مسیرهای HTTP مرکز Job (design §5.11 / §7، Requirements 1.5 / 10.1).
 *
 * بسته‌بندی Response Envelope توسط `ResponseInterceptor` سراسری و نگاشت خطا توسط
 * `AllExceptionsFilter` انجام می‌شود (Requirement 12)؛ بنابراین متدها دادهٔ خام
 * برمی‌گردانند و not-found از سرویس به‌صورت `DomainException` پرتاب می‌شود.
 *
 * **یادداشت احراز هویت:** اپلیکیشن هنوز guard احراز هویت سراسری ندارد و فرانت‌اند
 * فعلاً توکن ارسال نمی‌کند؛ بنابراین کاربر احرازشده روی request وجود ندارد. برای
 * باز نگه‌داشتن این مسیرها از افزودن `JwtAuthGuard` اجباری خودداری می‌کنیم و
 * `userId` را به‌صورت `null` به `createRefreshJob` می‌دهیم (ستون `jobs.created_by`
 * nullable است). هنگام اتصال احراز هویت، می‌توان actor واقعی را از request خواند.
 *
 * **نکتهٔ اجرا:** پس از ساخت Job یا `retryFailed`، `JobWorker.start()` فراخوانی
 * می‌شود تا حلقهٔ pump «هل» داده شود. `start()` idempotent است (اگر در حال اجرا
 * باشد بی‌اثر است) و این کار باعث می‌شود مسیر دسته‌ای حتی وقتی `jobs.enabled=false`
 * است نیز پس از وجود یک Job، یک‌بار اجرا شود.
 */
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobWorker: JobWorker,
  ) {}

  /**
   * POST /jobs/refresh — ساخت یک Job بروزرسانی دسته‌ای (Requirement 10.1).
   * worker پس از ساخت Job «هل» داده می‌شود تا task ها پردازش شوند.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.CREATED)
  async refresh(@Body() dto: RefreshJobDto) {
    // بدون guard احراز هویت سراسری، actor احرازشده‌ای در دسترس نیست (created_by nullable).
    const job = await this.jobService.createRefreshJob(dto, null as unknown as number);
    // هل دادن worker (idempotent) تا مسیر دسته‌ای حتی با jobs.enabled=false اجرا شود.
    this.jobWorker.start();
    return job;
  }

  /** GET /jobs — فهرست صفحه‌بندی‌شدهٔ Job ها (Requirement 12.5-12.7). */
  @Get()
  list(@Query() query: JobQuery) {
    return this.jobService.listJobs(query);
  }

  /** GET /jobs/:id — جزئیات کامل یک Job (status/progress/failedTasks/logs — Requirement 10.8). */
  @Get(':id')
  getJob(@Param('id') id: string) {
    return this.jobService.getJob(id);
  }

  /** POST /jobs/:id/cancel — لغو یک Job در حال اجرا (Requirement 10.10). */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string) {
    return this.jobService.cancel(id);
  }

  /**
   * POST /jobs/:id/retry-failed — بازگردانی task های `failed` به `pending`
   * (Requirement 10.5) و هل دادن worker تا task های بازگردانده‌شده برداشته شوند.
   */
  @Post(':id/retry-failed')
  @HttpCode(HttpStatus.OK)
  async retryFailed(@Param('id') id: string) {
    const job = await this.jobService.retryFailed(id);
    this.jobWorker.start();
    return job;
  }
}
