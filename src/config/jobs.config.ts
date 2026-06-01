import * as process from 'node:process';

/**
 * منبع واحد پیکربندی Job Center / JobWorker برای V2 (Requirement 10.9).
 *
 * مقدار `concurrency` تعداد task هایی است که `JobWorker` می‌تواند هم‌زمان اجرا
 * کند و طبق Requirement 10.9 باید از تنظیمات قابل‌پیکربندی خوانده شود (env
 * `JOBS_CONCURRENCY`). مقدار نامعتبر/غیرمثبت به پیش‌فرض امن برمی‌گردد.
 *
 * `enabled` تعیین می‌کند که آیا حلقهٔ پس‌زمینهٔ worker هنگام بوت به‌صورت خودکار
 * آغاز شود یا نه. تا زمانی که تسک ۷.۶ executor واقعی
 * (`CollectionService`/`AnalysisService`) را wire کند، پیش‌فرض **خاموش** است تا
 * worker با executor placeholder، task های واقعی را بی‌اثر مصرف نکند. در تست‌ها هم
 * خودکار آغاز نمی‌شود.
 *
 * `pollIntervalMs` فاصلهٔ بین pass های pump حلقهٔ پس‌زمینه است (وقتی هیچ task ای
 * نمانده باشد، worker این مدت صبر می‌کند و دوباره سرکشی می‌کند).
 */
export interface JobsConfig {
  /** حداکثر تعداد task هم‌زمان (Requirement 10.9). */
  concurrency: number;
  /** آیا حلقهٔ پس‌زمینه هنگام بوت خودکار آغاز شود؟ (پیش‌فرض false تا تسک ۷.۶). */
  enabled: boolean;
  /** فاصلهٔ بین pass های pump بر حسب میلی‌ثانیه. */
  pollIntervalMs: number;
  /**
   * آیا trigger دورهٔ‌ای بازسازی summary های داشبورد فعال است؟ (تسک ۱۱.۵،
   * Requirement 15.4). پیش‌فرض **خاموش** تا فعال‌سازی صریح؛ در محیط تست هرگز
   * خودکار اجرا نمی‌شود (در `onModuleInit` بررسی می‌شود).
   */
  analyticsRefreshEnabled: boolean;
  /**
   * فاصلهٔ بین اجراهای دورهٔ‌ای `refreshSummaries` بر حسب میلی‌ثانیه (تسک ۱۱.۵).
   * پیش‌فرض روزانه (۲۴ ساعت) — «یا یک Job دوره‌ای اجرا شود» در Requirement 15.4.
   */
  analyticsRefreshIntervalMs: number;
}

/** پیش‌فرض امن concurrency در صورت نبود/نامعتبر بودن مقدار env. */
export const DEFAULT_JOBS_CONCURRENCY = 5;

/** پیش‌فرض فاصلهٔ pump حلقهٔ پس‌زمینه (میلی‌ثانیه). */
export const DEFAULT_JOBS_POLL_INTERVAL_MS = 1000;

/** پیش‌فرض فاصلهٔ بازسازی دورهٔ‌ای summary های داشبورد (۲۴ ساعت بر حسب میلی‌ثانیه). */
export const DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * عددِ مثبتِ معتبر را از یک رشتهٔ env استخراج می‌کند؛ در غیر این صورت `fallback`.
 */
function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export const getJobsConfig = (): JobsConfig => ({
  concurrency: parsePositiveInt(
    process.env.JOBS_CONCURRENCY,
    DEFAULT_JOBS_CONCURRENCY,
  ),
  // پیش‌فرض خاموش — تا تسک ۷.۶ executor واقعی را wire کند؛ در محیط تست هرگز خودکار
  // آغاز نمی‌شود (در onModuleInit بررسی می‌شود).
  enabled:
    (process.env.JOBS_WORKER_ENABLED ?? 'false').toString().toLowerCase() ===
    'true',
  pollIntervalMs: parsePositiveInt(
    process.env.JOBS_POLL_INTERVAL_MS,
    DEFAULT_JOBS_POLL_INTERVAL_MS,
  ),
  // trigger دورهٔ‌ای بازسازی summary داشبورد — پیش‌فرض خاموش (تسک ۱۱.۵)؛ در تست هرگز
  // خودکار اجرا نمی‌شود (در onModuleInit بررسی می‌شود).
  analyticsRefreshEnabled:
    (process.env.ANALYTICS_REFRESH_ENABLED ?? 'false')
      .toString()
      .toLowerCase() === 'true',
  analyticsRefreshIntervalMs: parsePositiveInt(
    process.env.ANALYTICS_REFRESH_INTERVAL_MS,
    DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS,
  ),
});
