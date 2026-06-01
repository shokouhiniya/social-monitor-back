import { Source } from './source.types';
import { Paginated, PaginationInput } from '../common/pagination';

/**
 * درز delegation برای عملیات سنگین SourcesModule (design §2 — «AI لایهٔ مستقل
 * است» و §5.2 — «عملیات سنگین صرفاً delegate می‌شوند، خودشان fetch/LLM نمی‌کنند»).
 *
 * `SourcesService` هیچ fetch یا فراخوانی LLM انجام نمی‌دهد؛ در عوض از طریق این
 * واسط‌های تزریق‌شده به `CollectionService` (تسک ۳.۱۰) و `AnalysisService`
 * (تسک ۵.۸) واگذار می‌کند.
 *
 * این فایل صرفاً «قرارداد» (interface + token + نوع‌ها) را تعریف می‌کند؛ اتصال
 * نهایی به سرویس‌های واقعی در `SourcesModule` (تسک ۵.۱۱) انجام می‌شود:
 *  - `SOURCES_COLLECTION_DELEGATE` → `CollectionService` (سازگاری ساختاری مستقیم).
 *  - `SOURCES_ANALYSIS_DELEGATE`   → `SourcesAnalysisAdapter` که به
 *    `AnalysisService` واگذار می‌کند و تاریخچهٔ `analysis_runs` را به شکل
 *    قرارداد (`AnalysisRun`) نگاشت می‌دهد.
 */

/* ------------------------------------------------------------------ */
/* نوع‌های مشترک نتایج delegation (design §5.2, §5.5, §5.8, §6.3)        */
/* ------------------------------------------------------------------ */

/**
 * بازهٔ زمانی تحلیل یک منبع (design §5.2 — `analyze(id, timeframe)`).
 * مقادیر مجاز در `SOURCE_TIMEFRAMES` تعریف شده‌اند و با `CONTENT_TIMEFRAMES`
 * (مصرف‌شده توسط `AnalysisService.analyzeSource`) هم‌خوان نگه داشته شده‌اند.
 */
export const SOURCE_TIMEFRAMES = ['24h', '7d', '30d', '90d', 'all'] as const;
export type Timeframe = (typeof SOURCE_TIMEFRAMES)[number];

/**
 * خلاصهٔ یک اجرای واکشی (design §5.5 / §11.4). توسط `CollectionService`
 * بازگردانده می‌شود؛ شامل شمارش‌های واکشی و خطاهای نگاشت‌شده (نه استثنای خام).
 *
 * شکل این نوع عمداً با `CollectionRunSummary` در `collection/collection.types.ts`
 * یکسان است تا `CollectionService` بدون آداپتور به‌عنوان
 * `SourcesCollectionDelegate` wire شود (تسک ۵.۱۱ — `useExisting`).
 */
export interface CollectionRunSummary {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorReasons?: string[];
}

/**
 * وضعیت نهایی/جاری یک اجرای تحلیل (ستون `analysis_runs.status`). با
 * `AnalysisRunStatus` در `analysis/analysis.types.ts` هم‌خوان نگه داشته شده است
 * تا خروجی `AnalysisService.analyzeSource` بدون نگاشت به این قرارداد بنشیند.
 */
export type AnalysisRunStatus = 'running' | 'succeeded' | 'failed' | 'partial';

/**
 * خلاصهٔ یک اجرای تحلیل (design §5.8 / §6.3 — `analysis_runs`). توسط
 * `AnalysisService.analyzeSource` بازگردانده می‌شود.
 *
 * شکل این نوع عمداً با `AnalysisRunSummary` در `analysis/analysis.types.ts`
 * یکسان است (`runId`/`total`/`succeeded`/`failed`/`status`) تا جریان تحلیلِ
 * تک‌منبعی بدون آداپتورِ نگاشت از سرویس واقعی به این لایه برسد.
 */
export interface AnalysisRunSummary {
  runId: number;
  total: number;
  succeeded: number;
  failed: number;
  status: AnalysisRunStatus;
}

/**
 * خروجی structured بینش یک منبع (design §5.8 / §6.6 — `source_insight_results`).
 *
 * فیلدهای اختیاری عمداً `| null` را نیز می‌پذیرند تا موجودیت واقعی
 * `SourceInsightResultEntity` (که ستون‌های nullable دارد) به‌صورت ساختاری به این
 * قرارداد قابل‌انتساب باشد و `AnalysisService.generateSourceInsight` بدون نگاشت
 * مصرف شود.
 */
export interface SourceInsightResult {
  id?: number;
  source_id: number;
  narrative_description?: string | null;
  audience_description?: string | null;
  engagement_suggestion?: string | null;
  persona_radar?: Record<string, number> | null;
  pain_points?: string[] | null;
  topic_distribution?: Array<{ topic: string; weight: number }> | null;
  strategic_notes?: string[] | null;
  created_at?: Date;
}

/**
 * رکورد ردیابی یک اجرای تحلیل (design §6.3 — `analysis_runs`). این نوع شکل
 * مفهومی آیتم‌های تاریخچهٔ تحلیل را تعریف می‌کند که `getAnalysisHistory`
 * صفحه‌بندی‌شده برمی‌گرداند. `SourcesAnalysisAdapter` رکوردهای
 * `AnalysisRunEntity` را به این شکل نگاشت می‌دهد (`scope_ref` رشته‌ای → عددی).
 */
export interface AnalysisRun {
  id: number;
  type: 'content' | 'source_insight' | 'network_report';
  scope_ref: number;
  timeframe?: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  started_at?: Date;
  finished_at?: Date;
  triggered_by?: number | null;
}

/* ------------------------------------------------------------------ */
/* واسط‌های delegation + توکن‌های تزریق                                  */
/* ------------------------------------------------------------------ */

/**
 * واسط delegation به `CollectionModule` (تسک ۳.۱۰). `SourcesService.fetch`
 * تنها این متد را صدا می‌زند و خود هیچ واکشی‌ای انجام نمی‌دهد (Requirement 2.7).
 *
 * `CollectionService.collect(source, opts?)` به‌لطف پارامتر دوم اختیاری، به‌صورت
 * ساختاری با این امضا سازگار است.
 */
export interface SourcesCollectionDelegate {
  collect(source: Source): Promise<CollectionRunSummary>;
}

/**
 * واسط delegation به `AnalysisModule` (تسک ۵.۸). `SourcesService.analyze`،
 * `insight` و `getAnalysisHistory` تنها این متدها را صدا می‌زنند و خود هیچ
 * فراخوانی LLM یا query مستقیمی به `analysis_runs` انجام نمی‌دهند (Requirement
 * 2.7/2.8).
 */
export interface SourcesAnalysisDelegate {
  analyzeSource(
    sourceId: number,
    timeframe: Timeframe,
  ): Promise<AnalysisRunSummary>;
  generateSourceInsight(sourceId: number): Promise<SourceInsightResult>;
  getRunsForSource(
    sourceId: number,
    pagination: PaginationInput,
  ): Promise<Paginated<AnalysisRun>>;
}

/**
 * توکن تزریق delegate واکشی. در `SourcesModule` به `CollectionService` واقعی
 * متصل می‌شود (تسک ۵.۱۱).
 */
export const SOURCES_COLLECTION_DELEGATE = Symbol(
  'SOURCES_COLLECTION_DELEGATE',
);

/**
 * توکن تزریق delegate تحلیل. در `SourcesModule` به `SourcesAnalysisAdapter`
 * (لفافِ `AnalysisService`) متصل می‌شود (تسک ۵.۱۱).
 */
export const SOURCES_ANALYSIS_DELEGATE = Symbol('SOURCES_ANALYSIS_DELEGATE');
