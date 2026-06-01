import { Injectable, Logger } from '@nestjs/common';
import { JobTaskEntity } from './entities/job-task.entity';

/**
 * درز اجرای task (execution seam) برای `JobWorker` (تسک ۷.۴ / Requirement 10.7).
 *
 * `JobWorker` پس از claim کردن یک `JobTask` (با `FOR UPDATE SKIP LOCKED`) و بردن
 * آن به وضعیت `running`، اجرای **واقعی** کار را به این واسط می‌سپارد و سپس بر اساس
 * موفقیت/شکست، task را `succeeded`/`failed` می‌کند و پیشرفت Job را بازمحاسبه
 * می‌کند. به این ترتیب حلقهٔ claim/ایزولاسیون/پیشرفت کاملاً از منطق اجرای هر نوع
 * task جدا می‌ماند.
 *
 * پیاده‌سازی واقعی (مسیردهی بر اساس `task.type` به `CollectionService` برای
 * `fetch` و `AnalysisService` برای `analyze`/`insight` و refresh آنالیتیکس برای
 * `dashboard`) در **تسک ۷.۶** افزوده می‌شود و provider زیر را با نسخهٔ واقعی جایگزین
 * می‌کند. تا آن زمان `NoopJobTaskExecutor` به‌عنوان placeholder ثبت می‌شود.
 */
export interface JobTaskExecutor {
  /**
   * اجرای یک task. در صورت بروز خطا باید throw کند تا `JobWorker` آن را به‌صورت
   * ایزوله مدیریت کند (task به `failed` + `job_log` سطح `error` و ادامهٔ بقیه).
   */
  executeTask(task: JobTaskEntity): Promise<void>;
}

/**
 * توکن تزریق برای `JobTaskExecutor` (چون interface در زمان اجرا وجود ندارد).
 * تسک ۷.۶ همین توکن را با executor واقعی override می‌کند.
 */
export const JOB_TASK_EXECUTOR = Symbol('JOB_TASK_EXECUTOR');

/**
 * Executor پیش‌فرض placeholder (تسک ۷.۴) — تا زمانی که تسک ۷.۶ مسیردهی واقعی به
 * `CollectionService`/`AnalysisService` را wire کند، هیچ کاری انجام نمی‌دهد و تنها
 * یک هشدار ثبت می‌کند تا واضح باشد که هندلر واقعی هنوز متصل نشده است.
 *
 * این پیاده‌سازی throw نمی‌کند تا حلقهٔ worker و منطق ایزولاسیون مستقل از وجود
 * هندلر واقعی قابل اجرا/تست بماند.
 */
@Injectable()
export class NoopJobTaskExecutor implements JobTaskExecutor {
  private readonly logger = new Logger(NoopJobTaskExecutor.name);
  private warned = false;

  async executeTask(task: JobTaskEntity): Promise<void> {
    if (!this.warned) {
      this.logger.warn(
        'هیچ JobTaskExecutor واقعی متصل نشده است (placeholder تسک ۷.۴). ' +
          'مسیردهی fetch/analyze/insight/dashboard در تسک ۷.۶ wire می‌شود.',
      );
      this.warned = true;
    }
    this.logger.debug(
      `task #${task.id} (${task.type}) با executor placeholder بدون عملیات اجرا شد`,
    );
  }
}
