import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsQueryService } from '../analytics/analytics-query.service';
import {
  DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS,
  DEFAULT_JOBS_CONCURRENCY,
  DEFAULT_JOBS_POLL_INTERVAL_MS,
  JobsConfig,
} from '../config/jobs.config';

/**
 * AnalyticsRefreshScheduler — trigger دورهٔ‌ای بازسازی summary های داشبورد
 * (تسک ۱۱.۵، Requirement 15.4 / 8.6).
 *
 * Requirement 15.4 می‌گوید summary های داشبورد باید «وقتی یک Job بروزرسانی به
 * پایان برسد **یا یک Job دوره‌ای اجرا شود**» به‌روزرسانی شوند. مسیر «پایان Job»
 * توسط `RealJobTaskExecutor` (مرحلهٔ `dashboard`) پوشش داده شده؛ این provider
 * بخش «دورهٔ‌ای» را با یک pump سبک خودزمان‌بند فراهم می‌کند.
 *
 * **چرا setInterval و نه `ScheduleModule.forRoot`/`@Cron`؟** برای هم‌خوانی با
 * `JobWorker` (تسک ۷.۴) و کمینه نگه‌داشتن blast radius، از یک `setInterval`
 * خودکنترل استفاده می‌شود تا نیازی به ثبت سراسری `ScheduleModule` در root و
 * تغییر چیدمان bootstrap نباشد. `@nestjs/schedule` گرچه dependency است، اما
 * `ScheduleModule.forRoot` عمداً در root ثبت نشده است.
 *
 * **ایمنی محیط:** مانند `JobWorker`، در `NODE_ENV === 'test'` و وقتی
 * `jobs.analyticsRefreshEnabled !== true` باشد، حلقه به‌صورت خودکار آغاز
 * نمی‌شود (پیش‌فرض خاموش). تایمر `unref` می‌شود تا مانع خروج تمیز process نشود.
 *
 * برای تست قطعی، `triggerRefresh()` به‌صورت عمومی در دسترس است تا بدون تایمر
 * واقعی، یک بار `refreshSummaries` را با ایزولاسیون خطا اجرا کند.
 */
@Injectable()
export class AnalyticsRefreshScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AnalyticsRefreshScheduler.name);

  /** آیا حلقهٔ دورهٔ‌ای فعال است (start فراخوانی شده و stop نشده). */
  private running = false;
  /** هندل تایمر دورهٔ‌ای جاری (برای clear در stop). */
  private timer: NodeJS.Timeout | null = null;
  /** قفل سبک برای جلوگیری از اجرای هم‌پوشانِ دو tick. */
  private refreshing = false;

  constructor(
    private readonly analyticsQueryService: AnalyticsQueryService,
    private readonly configService: ConfigService,
  ) {}

  /** پیکربندی Job ها از تنظیمات (با پیش‌فرض امن در صورت نبود مقدار). */
  private get jobsConfig(): JobsConfig {
    return (
      this.configService.get<JobsConfig>('jobs') ?? {
        concurrency: DEFAULT_JOBS_CONCURRENCY,
        enabled: false,
        pollIntervalMs: DEFAULT_JOBS_POLL_INTERVAL_MS,
        analyticsRefreshEnabled: false,
        analyticsRefreshIntervalMs: DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS,
      }
    );
  }

  /** فاصلهٔ بازسازی دورهٔ‌ای بر حسب میلی‌ثانیه (حداقل ۱). */
  get intervalMs(): number {
    const value = this.jobsConfig.analyticsRefreshIntervalMs;
    return Number.isFinite(value) && value >= 1
      ? Math.floor(value)
      : DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS;
  }

  /* ---------------------------------------------------------------- */
  /* چرخهٔ حیات (lifecycle)                                            */
  /* ---------------------------------------------------------------- */

  /**
   * هنگام بوت، حلقه تنها در صورتی خودکار آغاز می‌شود که
   * `jobs.analyticsRefreshEnabled === true` باشد و محیط تست نباشد. پیش‌فرض
   * **خاموش** است تا فعال‌سازی صریح.
   */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (this.jobsConfig.analyticsRefreshEnabled) {
      this.start();
    } else {
      this.logger.log(
        'AnalyticsRefreshScheduler در حالت خاموش است ' +
          '(jobs.analyticsRefreshEnabled=false). بازسازی دورهٔ‌ای summary آغاز نشد.',
      );
    }
  }

  /** هنگام خاموش‌شدن ماژول، حلقه متوقف و تایمر clear می‌شود. */
  onModuleDestroy(): void {
    this.stop();
  }

  /** آغاز حلقهٔ دورهٔ‌ای (idempotent — اگر در حال اجراست بی‌اثر است). */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.logger.log(
      `AnalyticsRefreshScheduler آغاز شد (intervalMs=${this.intervalMs}).`,
    );
    this.timer = setInterval(() => {
      void this.triggerRefresh();
    }, this.intervalMs);
    // مانع نگه‌داشتن process زنده توسط تایمر نشو (اجازهٔ خروج تمیز).
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /** توقف حلقهٔ دورهٔ‌ای. */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /* اجرای یک بار (قابل‌فراخوانی مستقیم برای تست قطعی)                  */
  /* ---------------------------------------------------------------- */

  /**
   * یک اجرای `refreshSummaries` با ایزولاسیون کامل خطا. هیچ خطایی به بیرون نشت
   * نمی‌کند تا حلقهٔ دورهٔ‌ای برای همیشه متوقف نشود. اگر اجرای قبلی هنوز در حال
   * انجام باشد (`refreshing`)، این فراخوانی نادیده گرفته می‌شود تا دو بازسازی روی
   * هم نیفتند. `true` در صورت اجرای بازسازی و `false` در صورت پرش (هم‌پوشانی).
   */
  async triggerRefresh(): Promise<boolean> {
    if (this.refreshing) {
      this.logger.debug(
        'یک بازسازی summary قبلی هنوز در حال اجراست؛ این tick پرش شد.',
      );
      return false;
    }
    this.refreshing = true;
    try {
      await this.analyticsQueryService.refreshSummaries();
      this.logger.debug('بازسازی دورهٔ‌ای summary های داشبورد کامل شد.');
    } catch (err) {
      this.logger.error(
        `بازسازی دورهٔ‌ای summary های داشبورد ناموفق بود: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.refreshing = false;
    }
    return true;
  }
}
