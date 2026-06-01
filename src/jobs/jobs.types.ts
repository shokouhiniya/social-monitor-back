import { JobStatus, JobTaskStatus } from './job-state-machine';

/**
 * انواع مشترک JobsModule (Job Center — design §5.11 / §6.7، Requirement 10).
 *
 * این ماژول یک Job Center پایدار مبتنی بر Postgres است: یک `Job` چند `JobTask`
 * دارد و worker (تسک ۷.۴) آن‌ها را با `FOR UPDATE SKIP LOCKED` claim و اجرا
 * می‌کند. این فایل تنها انواع/ثابت‌های ماژول را تعریف می‌کند؛ منطق ماشین وضعیت در
 * `job-state-machine.ts` و منطق سرویس در `jobs.service.ts` است.
 */

/**
 * نوع یک Job. در فاز فعلی تنها `refresh` (بروزرسانی دسته‌ای منابع) استفاده می‌شود
 * اما مقدار به‌صورت رشته نگه داشته می‌شود تا انواع آینده بدون مهاجرت افزوده شوند.
 */
export type JobType = 'refresh' | string;

/** نوع پیش‌فرض Job بروزرسانی (Requirement 10.1). */
export const JOB_TYPE_REFRESH = 'refresh';

/**
 * نوع یک `JobTask` — یکی از مراحل اجرا (هم‌خوان با ستون `job_tasks.type` و مهاجرت
 * `Phase4Jobs`).
 */
export const JOB_TASK_TYPES = [
  'fetch',
  'analyze',
  'insight',
  'dashboard',
] as const;

export type JobTaskType = (typeof JOB_TASK_TYPES)[number];

/** سطح یک رکورد `job_logs` (هم‌خوان با ستون `job_logs.level`). */
export const JOB_LOG_LEVELS = ['info', 'success', 'error'] as const;

export type JobLogLevel = (typeof JOB_LOG_LEVELS)[number];

/**
 * شکل `config` ذخیره‌شده در `jobs.config` (jsonb). پارامترهای ورودیِ ساخت Job را
 * نگه می‌دارد تا اجرا قابل‌بازتولید/ردیابی باشد (Requirement 10.1).
 */
export interface JobScope {
  /** شناسهٔ منابعی که بروزرسانی می‌شوند. */
  sourceIds?: number[];
  /** مراحل اجرا به‌ترتیب (مثلاً `['fetch','analyze','insight','dashboard']`). */
  steps?: JobTaskType[];
  /** فیلدهای افزودهٔ اختیاری برای انواع Job آینده. */
  [key: string]: unknown;
}

/**
 * نمایش خلاصهٔ پیشرفت یک Job که در `getJob` و `listJobs` برگردانده می‌شود
 * (Requirement 10.8).
 */
export interface JobProgress {
  total: number;
  completed: number;
  failed: number;
  /** درصد پیشرفت در بازهٔ `[0,100]` بر مبنای `(completed + failed) / total`. */
  percent: number;
}

/**
 * نمای خلاصهٔ یک `JobTask` (برای نمایش `failedTasks` در `getJob` — Requirement 10.8).
 */
export interface JobTaskSummary {
  id: number;
  type: JobTaskType;
  target_ref: string | null;
  status: JobTaskStatus;
  attempts: number;
  error_message: string | null;
}

/**
 * نمای خلاصهٔ یک رکورد لاگ (برای نمایش `logs` در `getJob` — Requirement 10.8).
 */
export interface JobLogSummary {
  id: number;
  level: JobLogLevel;
  message: string;
  created_at: Date;
}

/**
 * نمای خلاصهٔ یک Job برای فهرست صفحه‌بندی‌شده (`listJobs` — design §5.11).
 */
export interface JobSummary {
  id: string;
  type: JobType;
  status: JobStatus;
  scope: string | null;
  progress: JobProgress;
  created_by: number | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

/**
 * نمای کامل یک Job (`getJob` — Requirement 10.8): وضعیت + پیشرفت + task های ناموفق
 * + لاگ‌ها.
 */
export interface JobDetail {
  id: string;
  type: JobType;
  status: JobStatus;
  scope: string | null;
  config: JobScope | null;
  progress: JobProgress;
  failedTasks: JobTaskSummary[];
  logs: JobLogSummary[];
  created_by: number | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}
