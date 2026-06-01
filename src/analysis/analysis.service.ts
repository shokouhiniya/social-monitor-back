import { Injectable } from '@nestjs/common';
import { Timeframe } from '../content/content.types';
import { Paginated, PaginationInput } from '../common/pagination';
import { AnalysisRunService } from './analysis-run.service';
import { ContentAnalysisService } from './content-analysis.service';
import { NetworkAnalysisService } from './network-analysis.service';
import { SourceInsightService } from './source-insight.service';
import { AnalysisRunSummary } from './analysis.types';
import { AnalysisRunEntity } from './entities/analysis-run.entity';
import { ContentAnalysisResultEntity } from './entities/content-analysis-result.entity';
import { NetworkReportResultEntity } from './entities/network-report-result.entity';
import { SourceInsightResultEntity } from './entities/source-insight-result.entity';

/**
 * AnalysisService — facade لایهٔ orchestration تحلیل (design §5.8، Requirement 7).
 *
 * این سرویس قرارداد طراحی را پیاده می‌کند و به سه سرویس تخصصی delegate می‌کند:
 *  - `ContentAnalysisService` — تحلیل محتوا (تک و دسته‌ای).
 *  - `SourceInsightService`   — بینش منبع.
 *  - `NetworkAnalysisService` — گزارش شبکه.
 *
 * امضای متدها عمداً با `SourcesAnalysisDelegate` در
 * `sources/sources.delegation.ts` سازگار است (`analyzeSource`,
 * `generateSourceInsight`) تا اتصال delegation تک‌منبعی در تسک ۵.۱۱ بدون
 * اصطکاک انجام شود.
 *
 * **مرز تسک ۵.۹ (دوگانه‌نویسی):** `analyzeContent` تنها در
 * `content_analysis_results` می‌نویسد؛ نوشتن اتمیک هم‌زمان در ستون‌های قدیمی
 * `posts` در تسک ۵.۹ افزوده می‌شود.
 */
@Injectable()
export class AnalysisService {
  constructor(
    private readonly contentAnalysisService: ContentAnalysisService,
    private readonly sourceInsightService: SourceInsightService,
    private readonly networkAnalysisService: NetworkAnalysisService,
    private readonly runService: AnalysisRunService,
  ) {}

  /**
   * تحلیل یک ContentItem و ذخیرهٔ `ContentAnalysisResult` (Requirement 7.1).
   */
  analyzeContent(contentId: number): Promise<ContentAnalysisResultEntity> {
    return this.contentAnalysisService.analyzeContent(contentId);
  }

  /**
   * تحلیل محتوای تحلیل‌نشدهٔ یک منبع در یک بازهٔ زمانی و برگرداندن
   * `AnalysisRunSummary` (Requirement 7.2/7.6).
   */
  analyzeSource(
    sourceId: number,
    timeframe: Timeframe,
    triggeredBy?: number,
  ): Promise<AnalysisRunSummary> {
    return this.contentAnalysisService.analyzeSource(
      sourceId,
      timeframe,
      triggeredBy,
    );
  }

  /**
   * تولید و ذخیرهٔ بینش یک منبع مطابق schema (Requirement 7.3).
   */
  generateSourceInsight(
    sourceId: number,
    triggeredBy?: number,
  ): Promise<SourceInsightResultEntity> {
    return this.sourceInsightService.generateSourceInsight(
      sourceId,
      triggeredBy,
    );
  }

  /**
   * تولید و ذخیرهٔ گزارش یک شبکه (Requirement 7.4).
   */
  generateNetworkReport(
    networkId: number,
    triggeredBy?: number,
  ): Promise<NetworkReportResultEntity> {
    return this.networkAnalysisService.generateNetworkReport(
      networkId,
      triggeredBy,
    );
  }

  /**
   * فهرست صفحه‌بندی‌شدهٔ اجراهای تحلیلِ یک منبع از جدول `analysis_runs`
   * (Requirement 2.8/7.6). برای تاریخچهٔ تحلیلِ منبع، اجراهای محتوا و بینش منبع
   * (`content` + `source_insight`) که `scope_ref = sourceId` دارند برگردانده
   * می‌شوند. مصرف‌کنندهٔ این متد، آداپتور delegation در `SourcesModule` (تسک
   * ۵.۱۱) است تا `SourcesService.getAnalysisHistory` بدون query مستقیم به
   * `analysis_runs` کار کند.
   */
  getRunsForSource(
    sourceId: number,
    pagination: PaginationInput,
  ): Promise<Paginated<AnalysisRunEntity>> {
    return this.runService.listByScope(sourceId, pagination, [
      'content',
      'source_insight',
    ]);
  }
}
