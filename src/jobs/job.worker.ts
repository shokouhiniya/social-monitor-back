import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS,
  DEFAULT_JOBS_CONCURRENCY,
  DEFAULT_JOBS_POLL_INTERVAL_MS,
  JobsConfig,
} from '../config/jobs.config';
import { JobTaskEntity } from './entities/job-task.entity';
import {
  JOB_TASK_EXECUTOR,
  JobTaskExecutor,
} from './job-task-executor';
import { JobService } from './jobs.service';

/**
 * JobWorker — حلقهٔ پس‌زمینهٔ Job Center (design §5.11 / §11.3، Requirements 10.6/10.7/10.9).
 *
 * مسئولیت‌ها:
 *  - **claim اتمیک** (Requirement 10.6): از طریق `JobService.claimNextPendingTask`
 *    که با `SELECT ... FOR UPDATE SKIP LOCKED` یک task `pending` را در یک تراکنش
 *    قفل و هم‌زمان به `running` می‌برد؛ بنابراین دو worker هرگز یک task را هم‌زمان
 *    claim نمی‌کنند.
 *  - **concurrency قابل‌پیکربندی** (Requirement 10.9): تعداد task های هم‌زمان از
 *    تنظیمات (`jobs.concurrency` در `configuration.ts`، env `JOBS_CONCURRENCY`)
 *    خوانده می‌شود.
 *  - **ایزولاسیون خطا** (Requirement 10.7): اگر اجرای یک task throw کند، آن task
 *    `failed` می‌شود (`markTaskFailed` که `error_message` + یک `job_log` سطح
 *    `error` ثبت می‌کند) و حلقه/سایر task ها بدون توقف ادامه می‌یابند. پس از هر
 *    task (موفق یا ناموفق) پیشرفت Job بازمحاسبه می‌شود (`recomputeProgress`).
 *
 * اجرای **واقعی** هر task (مسیردهی `fetch` → `CollectionService`،
 * `analyze`/`insight` → `AnalysisService`، `dashboard` → refresh آنالیتیکس) از
 * طریق درز تزریق‌شدهٔ `JobTaskExecutor` (توکن `JOB_TASK_EXECUTOR`) انجام می‌شود و
 * در **تسک ۷.۶** wire می‌شود؛ تا آن زمان `NoopJobTaskExecutor` ثبت است.
 *
 * مدل اجرا: یک pump خودزمان‌بند ساده با `setTimeout` (قابل توقف/کنترل کامل،
 * بدون نیاز به `ScheduleModule.forRoot` در root — کاهش blast radius). برای تست
 * قطعی، متدهای `processNext()` و `tick()` به‌صورت عمومی در دسترس‌اند تا بدون تایمر
 * واقعی، یک بار claim+اجرا انجام شود.
 */
@Injectable()
export class JobWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorker.name);

  /** آیا حلقهٔ pump فعال است (start فراخوانی شده و stop نشده). */
  private running = false;
  /** علامت توقف برای جلوگیری از شروع pass جدید پس از stop. */
  private stopping = false;
  /** هندل تایمر pump جاری (برای cancel در stop). */
  private timer: NodeJS.Timeout | null = null;
  /** قفل سبک برای جلوگیری از اجرای هم‌پوشانِ دو `tick`/pass. */
  private draining = false;

  constructor(
    private readonly jobService: JobService,
    private readonly configService: ConfigService,
    @Inject(JOB_TASK_EXECUTOR)
    private readonly executor: JobTaskExecutor,
  ) {}

  /* ---------------------------------------------------------------- */
  /* پیکربندی (Requirement 10.9)                                       */
  /* ---------------------------------------------------------------- */

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

  /** حداکثر تعداد task هم‌زمان از تنظیمات (Requirement 10.9). حداقل ۱. */
  get concurrency(): number {
    const value = this.jobsConfig.concurrency;
    return Number.isFinite(value) && value >= 1
      ? Math.floor(value)
      : DEFAULT_JOBS_CONCURRENCY;
  }

  /* ---------------------------------------------------------------- */
  /* چرخهٔ حیات (lifecycle)                                            */
  /* ---------------------------------------------------------------- */

  /**
   * هنگام بوت، حلقه تنها در صورتی خودکار آغاز می‌شود که `jobs.enabled === true`
   * باشد. پیش‌فرض **خاموش** است تا تسک ۷.۶ executor واقعی را wire کند و worker با
   * placeholder، task های واقعی را بی‌اثر مصرف نکند. در محیط تست نیز آغاز نمی‌شود.
   */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (this.jobsConfig.enabled) {
      this.start();
    } else {
      this.logger.log(
        'JobWorker در حالت خاموش است (jobs.enabled=false). حلقهٔ پس‌زمینه آغاز نشد ' +
          '(تا اتصال executor واقعی در تسک ۷.۶).',
      );
    }
  }

  /** هنگام خاموش‌شدن ماژول، حلقه متوقف و تایمر cancel می‌شود. */
  onModuleDestroy(): void {
    this.stop();
  }

  /** آغاز حلقهٔ pump پس‌زمینه (idempotent — اگر در حال اجراست بی‌اثر است). */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.stopping = false;
    this.logger.log(
      `JobWorker آغاز شد (concurrency=${this.concurrency}, ` +
        `pollIntervalMs=${this.jobsConfig.pollIntervalMs}).`,
    );
    this.schedulePump();
  }

  /** توقف حلقهٔ pump پس‌زمینه. task های در حال اجرا تا پایان ادامه می‌یابند. */
  stop(): void {
    this.running = false;
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /* حلقهٔ pump خودزمان‌بند                                            */
  /* ---------------------------------------------------------------- */

  private schedulePump(): void {
    if (!this.running) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.pump();
    }, this.jobsConfig.pollIntervalMs);
    // مانع نگه‌داشتن process زنده توسط تایمر نشو (اجازهٔ خروج تمیز).
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  private async pump(): Promise<void> {
    try {
      await this.tick();
    } catch (err) {
      // ایزولاسیون سطح حلقه: هیچ خطایی نباید pump را برای همیشه متوقف کند.
      this.logger.error(
        `خطای غیرمنتظره در pump حلقهٔ JobWorker: ${this.errorMessage(err)}`,
      );
    } finally {
      this.schedulePump();
    }
  }

  /* ---------------------------------------------------------------- */
  /* رانندگی قطعی (برای تست) و منطق اجرا                               */
  /* ---------------------------------------------------------------- */

  /**
   * یک «موج» اجرا: تا زمانی که task `pending` وجود دارد، به‌صورت دسته‌ای تا سقف
   * `concurrency` task را هم‌زمان claim و اجرا می‌کند و صف را تخلیه می‌کند. تعداد
   * کل task های پردازش‌شده را برمی‌گرداند. این متد برای تست قطعی به‌صورت مستقیم
   * قابل‌فراخوانی است.
   *
   * هم‌پوشانی محافظت‌شده: اگر `tick` دیگری در حال اجراست، فوراً ۰ برمی‌گرداند تا دو
   * موج هم‌زمان روی هم نیفتند (هرچند claim اتمیک به‌خودی‌خود ایمن است).
   */
  async tick(): Promise<number> {
    if (this.draining) {
      return 0;
    }
    this.draining = true;
    let processed = 0;
    try {
      const limit = this.concurrency;
      let keepGoing = true;
      while (keepGoing && !this.stopping) {
        const batch: Promise<boolean>[] = [];
        for (let i = 0; i < limit; i++) {
          batch.push(this.processNext());
        }
        const results = await Promise.all(batch);
        const claimed = results.filter(Boolean).length;
        processed += claimed;
        // اگر دستهٔ کامل پر شد، شاید task بیشتری مانده باشد → ادامه؛ در غیر این
        // صورت صف تخلیه شده است.
        keepGoing = claimed === limit;
      }
    } finally {
      this.draining = false;
    }
    return processed;
  }

  /**
   * claim اتمیک یک task و اجرای ایزولهٔ آن. اگر task ای برای claim نباشد `false`
   * برمی‌گرداند؛ در غیر این صورت پس از اجرا (موفق یا ناموفق) `true`.
   *
   * این متد برای تست قطعی مستقیماً قابل‌فراخوانی است.
   */
  async processNext(): Promise<boolean> {
    const task = await this.jobService.claimNextPendingTask();
    if (!task) {
      return false;
    }
    await this.runClaimedTask(task);
    return true;
  }

  /**
   * اجرای یک task که قبلاً claim و `running` شده، با ایزولاسیون کامل خطا
   * (Requirement 10.7): موفقیت → `succeeded`؛ خطا → `failed` با `error_message` و
   * `job_log` سطح `error`. در هر دو حالت پیشرفت Job بازمحاسبه می‌شود و هیچ خطایی
   * به بیرون نشت نمی‌کند تا حلقه/سایر task ها متوقف نشوند.
   */
  private async runClaimedTask(task: JobTaskEntity): Promise<void> {
    try {
      await this.executor.executeTask(task);
      await this.jobService.markTaskSucceeded(task.id);
    } catch (err) {
      const message = this.errorMessage(err);
      try {
        // ثبت failed + job_log سطح error (ایزولاسیون). شکست یک task کل Job را
        // متوقف نمی‌کند.
        await this.jobService.markTaskFailed(task.id, message);
      } catch (failErr) {
        // حتی اگر ثبت شکست هم خطا داد، حلقه نباید بشکند.
        this.logger.error(
          `ثبت شکست task #${task.id} ناموفق بود: ${this.errorMessage(failErr)}`,
        );
      }
    } finally {
      // بازمحاسبهٔ پیشرفت Job پس از هر task (موفق/ناموفق).
      try {
        await this.jobService.recomputeProgress(task.job_id);
      } catch (progressErr) {
        this.logger.error(
          `بازمحاسبهٔ پیشرفت Job ${task.job_id} ناموفق بود: ${this.errorMessage(
            progressErr,
          )}`,
        );
      }
    }
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }
}
