import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from '../modules/page/page.entity';
import { AnalysisModule } from '../analysis/analysis.module';
import { AnalysisService } from '../analysis/analysis.service';
import { CollectionModule } from '../collection/collection.module';
import { CollectionService } from '../collection/collection.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { SourcesAnalysisAdapter } from './sources-analysis.adapter';
import {
  SOURCES_ANALYSIS_DELEGATE,
  SOURCES_COLLECTION_DELEGATE,
} from './sources.delegation';

/**
 * SourcesModule — مدیریت منابع پایش (design §5.2).
 *
 * «Source» روی همان جدول `pages` نگاشت می‌شود؛ بنابراین به‌جای تعریف یک entity
 * دوم، موجودیت موجود `Page` دوباره استفاده می‌شود
 * (`TypeOrmModule.forFeature([Page])`) تا تعارض metadata در TypeORM رخ ندهد.
 *
 * در `app.module.ts` به‌صورت dual-import در کنار `PageModule` و سایر ماژول‌های
 * legacy ثبت می‌شود (Requirement 1.6).
 *
 * **اتصال delegation تک‌منبعی (تسک ۵.۱۱، Requirement 2.7/2.8):** عملیات سنگین
 * (`fetch`/`analyze`/`insight`/`getAnalysisHistory`) از طریق توکن‌های
 * `SOURCES_COLLECTION_DELEGATE` و `SOURCES_ANALYSIS_DELEGATE` به سرویس‌های واقعی
 * واگذار می‌شوند:
 *  - `SOURCES_COLLECTION_DELEGATE` → `CollectionService` (سازگاری ساختاری مستقیم
 *    `collect(source, opts?)`؛ بدون آداپتور — `useExisting`).
 *  - `SOURCES_ANALYSIS_DELEGATE`   → `SourcesAnalysisAdapter` (لفافِ نازکِ
 *    `AnalysisService` که تنها تاریخچهٔ `analysis_runs` را به شکل قرارداد نگاشت
 *    می‌دهد).
 *
 * **مرز acyclic:** تنها `PageModule` به `SourcesModule` وابسته است؛ نه
 * `CollectionModule` و نه `AnalysisModule` (و نه وابستگی‌های گذرای آن‌ها:
 * Content/Settings/Prompts/Ai/Networks/AuthV2) به `SourcesModule`/`PageModule`
 * وابسته نیستند. از این رو importِ این دو ماژول هیچ دوری ایجاد نمی‌کند و نیازی
 * به `forwardRef` نیست. `SourcesService` همچنان خودش هیچ fetch یا فراخوانی LLM
 * انجام نمی‌دهد و صرفاً delegate می‌کند.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Page]),
    CollectionModule,
    AnalysisModule,
  ],
  controllers: [SourcesController],
  providers: [
    SourcesService,
    SourcesAnalysisAdapter,
    // اتصال نهایی delegation به سرویس‌های واقعی (تسک ۵.۱۱).
    { provide: SOURCES_COLLECTION_DELEGATE, useExisting: CollectionService },
    { provide: SOURCES_ANALYSIS_DELEGATE, useExisting: SourcesAnalysisAdapter },
  ],
  exports: [SourcesService],
})
export class SourcesModule {}
