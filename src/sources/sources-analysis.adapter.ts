import { Injectable } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisRunEntity } from '../analysis/entities/analysis-run.entity';
import { Paginated, paginate, PaginationInput, normalizePagination } from '../common/pagination';
import {
  AnalysisRun,
  AnalysisRunSummary,
  SourceInsightResult,
  SourcesAnalysisDelegate,
  Timeframe,
} from './sources.delegation';

/**
 * آداپتور delegation تحلیل (تسک ۵.۱۱).
 *
 * این لفافِ نازک، `SourcesAnalysisDelegate` (قرارداد SourcesModule) را روی
 * `AnalysisService` واقعی پیاده می‌کند. دلیل وجود آداپتور به‌جای `useExisting`
 * مستقیم، تنها یک نگاشت کوچک است: ستون `analysis_runs.scope_ref` به‌صورت رشته
 * ذخیره می‌شود، اما قرارداد `AnalysisRun` آن را عددی می‌خواهد؛ پس تاریخچهٔ
 * صفحه‌بندی‌شده از `AnalysisRunEntity` به شکل قرارداد نگاشت می‌شود.
 *
 * `analyzeSource`/`generateSourceInsight` بدون نگاشت مستقیماً واگذار می‌شوند
 * (امضا و شکل خروجی عمداً سازگارند — Requirement 2.7). `SourcesService` خودش هیچ
 * فراخوانی LLM یا query به `analysis_runs` انجام نمی‌دهد (design §5.2).
 */
@Injectable()
export class SourcesAnalysisAdapter implements SourcesAnalysisDelegate {
  constructor(private readonly analysisService: AnalysisService) {}

  /** واگذاری مستقیم تحلیل منبع به `AnalysisService.analyzeSource`. */
  analyzeSource(
    sourceId: number,
    timeframe: Timeframe,
  ): Promise<AnalysisRunSummary> {
    return this.analysisService.analyzeSource(sourceId, timeframe);
  }

  /** واگذاری مستقیم تولید بینش منبع به `AnalysisService.generateSourceInsight`. */
  generateSourceInsight(sourceId: number): Promise<SourceInsightResult> {
    return this.analysisService.generateSourceInsight(sourceId);
  }

  /**
   * تاریخچهٔ صفحه‌بندی‌شدهٔ اجراهای تحلیل یک منبع (Requirement 2.8). نتیجهٔ
   * `AnalysisService.getRunsForSource` (مجموعه‌ای از `AnalysisRunEntity`) به شکل
   * قرارداد `AnalysisRun` نگاشت می‌شود (تبدیل `scope_ref` رشته‌ای به عددی).
   */
  async getRunsForSource(
    sourceId: number,
    pagination: PaginationInput,
  ): Promise<Paginated<AnalysisRun>> {
    const page = await this.analysisService.getRunsForSource(
      sourceId,
      pagination,
    );
    const normalized = normalizePagination(pagination);
    const mapped = page.items.map((run) => this.toAnalysisRun(run));
    return paginate(mapped, page.total, normalized);
  }

  /** نگاشت یک رکورد `analysis_runs` به شکل قرارداد `AnalysisRun`. */
  private toAnalysisRun(run: AnalysisRunEntity): AnalysisRun {
    const scopeRefNum = run.scope_ref !== null ? Number(run.scope_ref) : NaN;
    return {
      id: run.id,
      type: run.type,
      scope_ref: Number.isFinite(scopeRefNum) ? scopeRefNum : 0,
      timeframe: run.timeframe ?? undefined,
      status: run.status,
      total: run.total,
      succeeded: run.succeeded,
      failed: run.failed,
      started_at: run.started_at ?? undefined,
      finished_at: run.finished_at ?? undefined,
      triggered_by: run.triggered_by,
    };
  }
}
