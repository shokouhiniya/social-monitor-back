import { Injectable, Logger } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalyticsQueryService } from '../analytics/analytics-query.service';
import { CollectionService } from '../collection/collection.service';
import {
  CONTENT_TIMEFRAMES,
  Timeframe,
} from '../content/content.types';
import { SourcesService } from '../sources/sources.service';
import { ValidationException } from '../common/exceptions';
import { JobTaskEntity } from './entities/job-task.entity';
import { JobTaskExecutor } from './job-task-executor';
import { JobService } from './jobs.service';

/** بازهٔ زمانی پیش‌فرض تحلیل در مسیر دسته‌ای وقتی config مقداری ندارد. */
const DEFAULT_ANALYZE_TIMEFRAME: Timeframe = 'all';

/**
 * RealJobTaskExecutor — پیاده‌سازی واقعی درز اجرای task برای `JobWorker`
 * (تسک ۷.۶، Requirements 1.5 / 10.1).
 *
 * این executor جایگزین `NoopJobTaskExecutor` می‌شود و هر `JobTask` را بر اساس
 * `task.type` به سرویس دامنه‌ای مناسب مسیردهی می‌کند. مرجع منبع در
 * `task.target_ref` به‌صورت رشته نگه‌داری می‌شود (sourceId) و اینجا به عدد parse
 * می‌شود:
 *
 *  - `fetch`     → منبع از طریق `SourcesService.findById(sourceId)` resolve و
 *    سپس `CollectionService.collect(source)` اجرا می‌شود (Requirement 1.5/4.x).
 *  - `analyze`   → `AnalysisService.analyzeSource(sourceId, timeframe)`؛ timeframe
 *    از `config` Job والد (در صورت وجود) مشتق می‌شود وگرنه `'all'`
 *    (Requirement 1.5/7.2).
 *  - `insight`   → `AnalysisService.generateSourceInsight(sourceId)`
 *    (Requirement 1.5/7.3).
 *  - `dashboard` → `AnalyticsQueryService.refreshSummaries()` (تسک ۱۱.۵،
 *    Requirement 15.4 / 8.6): در پایان Job بروزرسانی جدول‌های summary روزانه
 *    بازسازی می‌شوند تا داشبوردها بدون محاسبهٔ بلادرنگ سنگین پاسخ دهند.
 *    `refreshSummaries` همهٔ summary ها را به‌صورت سراسری و idempotent (با upsert)
 *    بازمی‌سازد؛ بنابراین `target_ref` در این مسیر بی‌اثر است و parse نمی‌شود.
 *    برخلاف fetch/analyze/insight، خطای `dashboard` نیز عمداً propagate می‌شود تا
 *    شکست refresh در `error_message`/`job_log` بازتاب یابد و worker آن را ایزوله
 *    کند (بقیهٔ task ها متوقف نمی‌شوند).
 *
 *    نکتهٔ بهینه‌سازی آینده: `createRefreshJob` مرحلهٔ `dashboard` را به‌ازای **هر
 *    منبع** fan-out می‌کند، پس برای یک Job با n منبع، `refreshSummaries` تا n بار
 *    اجرا می‌شود. چون عملیات سراسری و idempotent است این تکرار درست ولی هدررفت
 *    است؛ بهینه‌سازی کم‌ریسک آینده، انتشار یک task `dashboard` واحد به‌ازای هر Job
 *    (نه هر منبع) است. این تسک fan-out را بازطراحی نمی‌کند تا ریسک پایین بماند.
 *
 * **ایزولاسیون خطا (Requirement 10.7):** برای `fetch`/`analyze`/`insight`/
 * `dashboard` هر خطا عمداً throw می‌شود تا `JobWorker` task را `failed` کند،
 * `error_message` و یک `job_log` سطح `error` ثبت کند و اجرای بقیهٔ task ها ادامه
 * یابد. این executor خطاها را خود مدیریت/بلعیده نمی‌کند.
 *
 * **جهت وابستگی (Requirement 1.2):** `JobsModule` ماژول‌های
 * `SourcesModule`/`CollectionModule`/`AnalysisModule`/`AnalyticsV2Module` را
 * import می‌کند و هیچ‌یک از آن‌ها به `JobsModule` وابسته نیست؛ بنابراین گراف بدون
 * دور است و نیازی به `forwardRef` نیست. `AnalyticsV2Module` تنها به repository های
 * summary خود و `DataSource` وابسته است (بدون سرویس دامنه‌ای)، پس
 * `JobsModule → AnalyticsV2Module` قطعاً acyclic است.
 */
@Injectable()
export class RealJobTaskExecutor implements JobTaskExecutor {
  private readonly logger = new Logger(RealJobTaskExecutor.name);

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly collectionService: CollectionService,
    private readonly analysisService: AnalysisService,
    private readonly analyticsQueryService: AnalyticsQueryService,
    private readonly jobService: JobService,
  ) {}

  async executeTask(task: JobTaskEntity): Promise<void> {
    switch (task.type) {
      case 'fetch':
        await this.runFetch(task);
        return;
      case 'analyze':
        await this.runAnalyze(task);
        return;
      case 'insight':
        await this.runInsight(task);
        return;
      case 'dashboard':
        await this.runDashboard(task);
        return;
      default:
        // نوع ناشناخته — throw تا به‌صورت failed ثبت شود (ایزولاسیون خطا).
        throw new ValidationException(
          `نوع task پشتیبانی‌نشده برای اجرا: ${String(task.type)}`,
        );
    }
  }

  /* ---------------------------------------------------------------- */
  /* مسیردهی هر نوع task                                               */
  /* ---------------------------------------------------------------- */

  /** `fetch` → resolve منبع و واکشی محتوا از طریق CollectionService. */
  private async runFetch(task: JobTaskEntity): Promise<void> {
    const sourceId = this.parseSourceId(task);
    const source = await this.sourcesService.findById(sourceId);
    await this.collectionService.collect(source);
  }

  /** `analyze` → تحلیل محتوای منبع در timeframe مشتق‌شده از config Job. */
  private async runAnalyze(task: JobTaskEntity): Promise<void> {
    const sourceId = this.parseSourceId(task);
    const timeframe = await this.resolveTimeframe(task.job_id);
    await this.analysisService.analyzeSource(sourceId, timeframe);
  }

  /** `insight` → تولید بینش منبع. */
  private async runInsight(task: JobTaskEntity): Promise<void> {
    const sourceId = this.parseSourceId(task);
    await this.analysisService.generateSourceInsight(sourceId);
  }

  /**
   * `dashboard` → بازسازی جدول‌های summary روزانهٔ داشبورد (تسک ۱۱.۵،
   * Requirement 15.4 / 8.6). `refreshSummaries` عملیاتی سراسری و idempotent است
   * (upsert در جدول‌های `*_daily_metrics`)؛ بنابراین `target_ref` این task بی‌اثر
   * است و parse نمی‌شود. خطا عمداً propagate می‌شود تا worker آن را ایزوله و در
   * لاگ Job ثبت کند.
   */
  private async runDashboard(task: JobTaskEntity): Promise<void> {
    this.logger.debug(
      `task #${task.id} (dashboard) → refreshSummaries آنالیتیکس اجرا می‌شود.`,
    );
    await this.analyticsQueryService.refreshSummaries();
  }

  /* ---------------------------------------------------------------- */
  /* کمکی‌ها                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * parse مرجع منبع از `task.target_ref` (رشته → عدد). در صورت نامعتبر بودن،
   * `ValidationException` پرتاب می‌شود تا task به‌صورت `failed` ثبت گردد.
   */
  private parseSourceId(task: JobTaskEntity): number {
    const raw = task.target_ref;
    const parsed = Number(raw);
    if (raw === null || raw === '' || !Number.isInteger(parsed)) {
      throw new ValidationException(
        `target_ref نامعتبر برای task #${task.id} (${task.type}): ${String(raw)}`,
      );
    }
    return parsed;
  }

  /**
   * مشتق‌سازی `timeframe` از `config` Job والد (در صورت وجود مقدار معتبر) وگرنه
   * مقدار پیش‌فرض `'all'`. خواندن config با شکست‌خوریِ امن انجام می‌شود: اگر
   * خواندن Job ناموفق شد، به‌جای شکست task، به پیش‌فرض برمی‌گردیم و هشدار می‌دهیم
   * (timeframe به‌ازای هر Job می‌تواند بعداً به‌صراحت در config ثبت شود).
   */
  private async resolveTimeframe(jobId: string): Promise<Timeframe> {
    try {
      const job = await this.jobService.getJob(jobId);
      const candidate = job.config?.timeframe;
      if (
        typeof candidate === 'string' &&
        (CONTENT_TIMEFRAMES as readonly string[]).includes(candidate)
      ) {
        return candidate as Timeframe;
      }
    } catch (err) {
      this.logger.warn(
        `خواندن timeframe از config Job ${jobId} ناموفق بود؛ بازگشت به پیش‌فرض ` +
          `'${DEFAULT_ANALYZE_TIMEFRAME}': ${
            err instanceof Error ? err.message : String(err)
          }`,
      );
    }
    return DEFAULT_ANALYZE_TIMEFRAME;
  }
}
