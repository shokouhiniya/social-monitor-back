import { Timeframe } from '../content/content.types';

/**
 * انواع مشترک AnalysisModule (لایهٔ orchestration — design §5.8، Requirement 7).
 *
 * این ماژول هماهنگ‌کنندهٔ تحلیل است: نسخهٔ فعال prompt را از `PromptsService`
 * resolve می‌کند، آن را از طریق `AiService` اجرا می‌کند و نتیجهٔ structured را در
 * خانوادهٔ جدول‌های `*_results` و رکورد ردیابی `analysis_runs` ذخیره می‌کند.
 */

export { Timeframe };

/**
 * نوع یک اجرای تحلیل (ستون `analysis_runs.type`). با مقادیر مفهومی در
 * `sources.delegation.ts` (`AnalysisRun.type`) هم‌خوان نگه داشته شده است.
 */
export type AnalysisRunType = 'content' | 'source_insight' | 'network_report';

/**
 * وضعیت نهایی/جاری یک اجرای تحلیل (ستون `analysis_runs.status`، Requirement 7.6).
 *
 *  - `running`   : اجرا آغاز شده و در حال پردازش است (وضعیت اولیه پس از ساخت).
 *  - `succeeded` : همهٔ آیتم‌ها با موفقیت تحلیل شدند (یا چیزی برای تحلیل نبود).
 *  - `failed`    : هیچ آیتمی با موفقیت تحلیل نشد (همه شکست خوردند).
 *  - `partial`   : بخشی موفق و بخشی ناموفق (`succeeded > 0 && failed > 0`).
 */
export type AnalysisRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'partial';

/**
 * خلاصهٔ یک اجرای تحلیل (design §5.8 / §6.3 — `analysis_runs`).
 *
 * این شکل **عمداً** با placeholder `AnalysisRunSummary` در
 * `sources/sources.delegation.ts` سازگار است (همان فیلدهای `total`/`succeeded`/
 * `failed`) تا اتصال delegation تک‌منبعی در تسک ۵.۱۱ بدون اصطکاک انجام شود؛
 * `runId` و `status` فیلدهای افزودهٔ ردیابی‌اند.
 */
export interface AnalysisRunSummary {
  /** شناسهٔ رکورد `analysis_runs` ساخته‌شده برای این اجرا. */
  runId: number;
  /** تعداد کل آیتم‌های نامزد تحلیل در این اجرا. */
  total: number;
  /** تعداد آیتم‌های با تحلیل موفق و ذخیره‌شده. */
  succeeded: number;
  /** تعداد آیتم‌های ناموفق (خطای schema/provider/timeout). */
  failed: number;
  /** وضعیت نهایی اجرا. */
  status: AnalysisRunStatus;
}

/**
 * نتیجهٔ داخلی تحلیل یک آیتم منفرد (مصرف داخلی توسط حلقهٔ batch).
 *
 * در حالت موفق `ok = true` و `result` نتیجهٔ ذخیره‌شده است؛ در حالت ناموفق
 * `ok = false` و `error` یک `DomainException` با کد نمادین مناسب است (که در
 * مسیر تک‌آیتمی پرتاب می‌شود و در مسیر batch صرفاً شمارش می‌شود — Requirement
 * 7.5/7.6).
 */
export interface ItemAnalysisOutcome<T> {
  ok: boolean;
  result?: T;
  error?: Error;
  /** علت شکست برای لاگ/شمارش (validation_error | provider_error | timeout). */
  failureReason?: string;
}

/** کلید prompt تحلیل محتوا (seed — design §5.7). */
export const CONTENT_ANALYSIS_PROMPT_KEY = 'content_analysis';
/** کلید prompt بینش روایی منبع (seed — design §5.7). */
export const SOURCE_INSIGHT_PROMPT_KEY = 'source_narrative_insight';
/** کلید prompt خلاصهٔ هوشمند شبکه (seed — design §5.7). */
export const NETWORK_REPORT_PROMPT_KEY = 'network_ai_summary';
