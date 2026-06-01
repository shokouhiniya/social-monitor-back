import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsQueryService } from './analytics-query.service';
import { ClusterDailyMetricEntity } from './entities/cluster-daily-metric.entity';
import { KeywordDailyMetricEntity } from './entities/keyword-daily-metric.entity';
import { NetworkDailyMetricEntity } from './entities/network-daily-metric.entity';
import { SourceDailyMetricEntity } from './entities/source-daily-metric.entity';

/**
 * AnalyticsV2Module — لایهٔ تجمیع فقط‌خواندنی داشبورد (design §5.9، Requirement 8).
 *
 * **نام‌گذاری (reconciliation):** یک `AnalyticsModule` قدیمی در
 * `src/modules/analytics/analytics.module.ts` وجود دارد و در `app.module.ts`
 * با همان نام import می‌شود (دورهٔ گذار — Requirement 1.6). برای پرهیز از تعارض
 * نام در import، این ماژول جدید با کلاس `AnalyticsV2Module` صادر می‌شود (نه
 * `AnalyticsModule`). ماژول legacy دست‌نخورده باقی می‌ماند.
 *
 * **مرز وابستگی (design §3.2، Requirement 8.1 / 1.3):**
 *  - تنها `TypeOrmModule.forFeature` چهار موجودیت summary روزانه را ثبت می‌کند.
 *  - **هیچ** وابستگی به `SourcesModule`/`SourcesService` یا سرویس دامنه‌ای دیگر
 *    ندارد؛ بنابراین هیچ `forwardRef` و هیچ وابستگی circular لازم نیست.
 *  - `AnalyticsQueryService` متدهای query را فقط از جدول‌های `*_daily_metrics`
 *    می‌خواند و تنها `refreshSummaries` (با `DataSource` و SQL پارامتری) در همان
 *    جدول‌های summary می‌نویسد. هیچ fetch/LLM در این لایه نیست.
 *
 * `AnalyticsQueryService` صادر می‌شود تا در تسک ۱۱.۵ مسیر Job بتواند
 * `refreshSummaries` را در پایان Job بروزرسانی و از طریق Job دوره‌ای فراخواند.
 * این ماژول عمداً کنترلر ندارد (سطح حداقلی) تا با مسیرهای legacy `/analytics`
 * تداخل نکند؛ نمایش endpoint های REST در فاز بعدی روی namespace جدا انجام می‌شود.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NetworkDailyMetricEntity,
      SourceDailyMetricEntity,
      KeywordDailyMetricEntity,
      ClusterDailyMetricEntity,
    ]),
  ],
  providers: [AnalyticsQueryService],
  exports: [AnalyticsQueryService],
})
export class AnalyticsV2Module {}
