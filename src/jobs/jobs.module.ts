import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisModule } from '../analysis/analysis.module';
import { AnalyticsV2Module } from '../analytics/analytics.module';
import { CollectionModule } from '../collection/collection.module';
import { SourcesModule } from '../sources/sources.module';
import { JobEntity } from './entities/job.entity';
import { JobTaskEntity } from './entities/job-task.entity';
import { JobLogEntity } from './entities/job-log.entity';
import { JobsController } from './jobs.controller';
import { JobService } from './jobs.service';
import { JobWorker } from './job.worker';
import { AnalyticsRefreshScheduler } from './analytics-refresh.scheduler';
import { JOB_TASK_EXECUTOR } from './job-task-executor';
import { RealJobTaskExecutor } from './real-job-task-executor';

/**
 * JobsModule — Job Center پایدار مبتنی بر Postgres (design §5.11، Requirement 10).
 *
 * این ماژول لایهٔ **سرویس + ماشین وضعیت + موجودیت‌ها + worker پس‌زمینه** را فراهم
 * می‌کند:
 *  - `TypeOrmModule.forFeature` سه موجودیت `JobEntity`/`JobTaskEntity`/
 *    `JobLogEntity` را ثبت می‌کند (هم‌خوان با مهاجرت `Phase4Jobs1739500000000`).
 *  - `JobService` (createRefreshJob/getJob/listJobs/cancel/retryFailed +
 *    متدهای کمکی worker شامل `claimNextPendingTask` با `FOR UPDATE SKIP LOCKED`)
 *    فراهم و **export** می‌شود.
 *  - `JobWorker` (تسک ۷.۴) حلقهٔ پس‌زمینهٔ claim/اجرا/ایزولاسیون خطا/پیشرفت را با
 *    concurrency قابل‌پیکربندی از تنظیمات اجرا می‌کند و **export** می‌شود تا تسک
 *    ۷.۶ بتواند آن را در مسیر دسته‌ای کنترل کند.
 *  - `JOB_TASK_EXECUTOR` درز اجرای task است؛ فعلاً با `NoopJobTaskExecutor`
 *    (placeholder) ثبت می‌شود و تسک ۷.۶ آن را با مسیردهی واقعی به
 *    `CollectionService`/`AnalysisService` override می‌کند.
 *
 * مرزهای خارج از این تسک:
 *  - `JobsController` و wire کردن executor واقعی به `CollectionService`/
 *    `AnalysisService` در تسک ۷.۶ افزوده می‌شوند.
 *
 * **اتصال تسک ۷.۶:** `JobsController` افزوده شد و executor واقعی
 * (`RealJobTaskExecutor`) جایگزین `NoopJobTaskExecutor` شد. این ماژول اکنون
 * `SourcesModule`/`CollectionModule`/`AnalysisModule` را import می‌کند تا executor
 * بتواند `fetch` را به `CollectionService` و `analyze`/`insight` را به
 * `AnalysisService` مسیردهی کند.
 *
 * **اتصال تسک ۱۱.۵:** `AnalyticsV2Module` نیز import می‌شود تا executor مرحلهٔ
 * `dashboard` را به `AnalyticsQueryService.refreshSummaries` مسیردهی کند
 * (Requirement 15.4 / 8.6). علاوه بر مسیر Job، `AnalyticsRefreshScheduler` یک
 * trigger دوره‌ای سبک فراهم می‌کند تا summary ها به‌صورت زمان‌بندی‌شده هم بازسازی
 * شوند («یا یک Job دوره‌ای اجرا شود» در Requirement 15.4).
 *
 * **مرز acyclic (Requirement 1.2):** تنها `app.module` به `JobsModule` وابسته
 * است؛ هیچ‌یک از `SourcesModule`/`CollectionModule`/`AnalysisModule`/
 * `AnalyticsV2Module` به `JobsModule` وابسته نیست. به‌ویژه `AnalyticsV2Module`
 * تنها به repository های summary خود و `DataSource` وابسته است (بدون سرویس
 * دامنه‌ای)، پس import آن دوری ایجاد نمی‌کند و نیازی به `forwardRef` نیست.
 *
 * نکتهٔ زمان‌بندی: هم `JobWorker` و هم `AnalyticsRefreshScheduler` به‌جای
 * `ScheduleModule.forRoot` از یک pump خودزمان‌بند با `setTimeout`/`setInterval`
 * استفاده می‌کنند تا blast radius کمینه بماند (نیازی به import سراسری
 * `ScheduleModule` نیست) و در محیط تست خودکار اجرا نشوند.
 *
 * در `app.module.ts` به‌صورت dual-import در کنار ماژول‌های دیگر ثبت می‌شود
 * (Requirement 1.6).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, JobTaskEntity, JobLogEntity]),
    SourcesModule,
    CollectionModule,
    AnalysisModule,
    AnalyticsV2Module,
  ],
  controllers: [JobsController],
  providers: [
    JobService,
    JobWorker,
    AnalyticsRefreshScheduler,
    // درز اجرای task — اکنون به executor واقعی (تسک ۷.۶ + ۱۱.۵) متصل است.
    { provide: JOB_TASK_EXECUTOR, useClass: RealJobTaskExecutor },
  ],
  exports: [JobService, JobWorker, AnalyticsRefreshScheduler],
})
export class JobsModule {}
