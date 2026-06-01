import {
  TransitionMap,
  allowedTargets,
  canTransition,
} from '../operations/state-machines/state-machine.util';

/**
 * ماشین وضعیت خالص (pure) برای JobsModule (design §5.11 / Requirement 10.2-10.5).
 *
 * این ماژول هیچ side-effect یا I/O ندارد و تنها روی «نقشهٔ گذارهای مجاز» تصمیم
 * می‌گیرد؛ بنابراین هم در `JobService` و هم در property test (تسک ۷.۳) مستقیماً
 * قابل استفاده است. الگوی آن دقیقاً از `operations/state-machines/state-machine.util.ts`
 * و `action-plan.state-machine.ts` پیروی می‌کند (نقشهٔ گذار + `canTransition` خالص).
 */

/**
 * وضعیت‌های مجاز برای یک `Job` یا `JobTask` (Requirement 10.2). هر دو موجودیت از
 * همین مجموعهٔ شش‌تایی استفاده می‌کنند.
 */
export const JOB_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'skipped',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** وضعیت `JobTask` هم‌مجموعه با وضعیت `Job` است (Requirement 10.2). */
export type JobTaskStatus = JobStatus;

/** وضعیت اولیهٔ معتبر هنگام ساخت یک `Job` یا `JobTask` (Requirement 10.1). */
export const JOB_INITIAL_STATUS: JobStatus = 'pending';

/**
 * نقشهٔ گذارهای مجاز `JobTask` (Requirement 10.3):
 *
 *   pending → running
 *   running → {succeeded, failed, skipped}
 *   pending → {cancelled, skipped}
 *   running → cancelled
 *   failed  → pending           (تنها از طریق `retryFailed`)
 *
 * هیچ گذاری از یک وضعیت پایانی به وضعیت دیگر مجاز نیست، **به‌جز** `failed → pending`
 * که فقط در مسیر `retryFailed` استفاده می‌شود. `succeeded`, `cancelled` و `skipped`
 * وضعیت‌های پایانیِ بدون خروج‌اند (آرایهٔ خالی).
 */
export const JOB_TASK_TRANSITIONS: TransitionMap<JobTaskStatus> = {
  pending: ['running', 'cancelled', 'skipped'],
  running: ['succeeded', 'failed', 'skipped', 'cancelled'],
  succeeded: [],
  failed: ['pending'],
  cancelled: [],
  skipped: [],
};

/**
 * نقشهٔ گذارهای مجاز `Job` (سطح بالاتر). مشابه task اما در سطح کل اجرا:
 *
 *   pending → {running, cancelled}
 *   running → {succeeded, failed, cancelled}
 *   succeeded/failed → pending   (بازگشایی توسط `retryFailed`)
 *
 * بازگشایی job از وضعیت پایانیِ `succeeded`/`failed` به `pending` تنها زمانی رخ
 * می‌دهد که taskهای `failed` با `retryFailed` دوباره `pending` شوند (Requirement
 * 10.5)؛ `cancelled` وضعیت پایانیِ نهایی است.
 */
export const JOB_TRANSITIONS: TransitionMap<JobStatus> = {
  pending: ['running', 'succeeded', 'failed', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: ['pending'],
  failed: ['pending'],
  cancelled: [],
  skipped: [],
};

/** آیا گذار وضعیت روی یک `JobTask` مجاز است؟ (تابع خالص — Requirement 10.3) */
export function canTransitionTask(
  from: JobTaskStatus,
  to: JobTaskStatus,
): boolean {
  return canTransition(JOB_TASK_TRANSITIONS, from, to);
}

/** آیا گذار وضعیت روی یک `Job` مجاز است؟ (تابع خالص) */
export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return canTransition(JOB_TRANSITIONS, from, to);
}

/** فهرست وضعیت‌های مقصدِ مجاز task از یک وضعیت مشخص (برای پیام خطا/UI). */
export function allowedTaskTargets(
  from: JobTaskStatus,
): readonly JobTaskStatus[] {
  return allowedTargets(JOB_TASK_TRANSITIONS, from);
}

/** فهرست وضعیت‌های مقصدِ مجاز job از یک وضعیت مشخص (برای پیام خطا/UI). */
export function allowedJobTargets(from: JobStatus): readonly JobStatus[] {
  return allowedTargets(JOB_TRANSITIONS, from);
}

/** آیا وضعیت `JobTask` پایانی است (هیچ گذاری به جلو ندارد، به‌جز failed→pending)؟ */
export function isTerminalTaskStatus(status: JobTaskStatus): boolean {
  return (
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'skipped'
  );
}

/* ------------------------------------------------------------------ */
/* محاسبهٔ خالص پیشرفت (Progress) و وضعیت مشتق‌شدهٔ Job — Requirement 10.4 */
/* ------------------------------------------------------------------ */

/**
 * شمارش‌های تفکیکی وضعیت taskهای یک Job. تابع `computeProgress` این ساختار را از
 * روی فهرست وضعیت taskها می‌سازد؛ کاملاً خالص و قابل‌تست مستقیم است.
 */
export interface ProgressCounts {
  /** تعداد کل task ها. */
  total: number;
  /** task های موفق (`succeeded`) — همان `completed_tasks` در جدول jobs. */
  completed: number;
  /** task های ناموفق (`failed`) — همان `failed_tasks` در جدول jobs. */
  failed: number;
  /** task های رد‌شده (`skipped`). */
  skipped: number;
  /** task های لغوشده (`cancelled`). */
  cancelled: number;
  /** task های در انتظار (`pending`). */
  pending: number;
  /** task های در حال اجرا (`running`). */
  running: number;
}

/**
 * شمارش وضعیت task ها از روی فهرست وضعیت‌ها.
 *
 * `total` به‌صورت پیش‌فرض برابر طول آرایه است، اما در صورت ارائهٔ `totalOverride`
 * (مثلاً `jobs.total_tasks` ثبت‌شده هنگام ساخت) از آن استفاده می‌شود تا ناوردای
 * `completed + failed ≤ total` حتی هنگام جزئی بودن داده‌ها حفظ شود (Requirement 10.4).
 */
export function computeProgress(
  taskStatuses: readonly JobTaskStatus[],
  totalOverride?: number,
): ProgressCounts {
  const counts: ProgressCounts = {
    total: totalOverride ?? taskStatuses.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    pending: 0,
    running: 0,
  };

  for (const status of taskStatuses) {
    switch (status) {
      case 'succeeded':
        counts.completed += 1;
        break;
      case 'failed':
        counts.failed += 1;
        break;
      case 'skipped':
        counts.skipped += 1;
        break;
      case 'cancelled':
        counts.cancelled += 1;
        break;
      case 'pending':
        counts.pending += 1;
        break;
      case 'running':
        counts.running += 1;
        break;
    }
  }

  return counts;
}

/**
 * بررسی ناوردای پیشرفت `completed + failed ≤ total` (Requirement 10.4). این ناوردا
 * باید در هر لحظه برقرار باشد.
 */
export function progressInvariantHolds(counts: ProgressCounts): boolean {
  return counts.completed + counts.failed <= counts.total;
}

/**
 * آیا همهٔ task ها به وضعیت پایانی رسیده‌اند (هیچ `pending`/`running` باقی نمانده)؟
 */
export function isJobComplete(counts: ProgressCounts): boolean {
  return counts.pending === 0 && counts.running === 0;
}

/**
 * وضعیت Job را از روی شمارش task ها به‌صورت خالص استنتاج می‌کند (سیاست پیش‌فرض —
 * design §11.3).
 *
 *  - اگر هیچ task ای نمانده باشد (`total === 0`) → `succeeded` (کاری برای انجام نبود).
 *  - اگر task فعالی (`pending`/`running`) باقی باشد:
 *      • اگر هیچ پیشرفتی (running یا terminal) نباشد → `pending`،
 *      • در غیر این صورت → `running`.
 *  - اگر همه پایانی شده‌اند:
 *      • اگر همه `cancelled` باشند → `cancelled`،
 *      • وگرنه اگر حداقل یک `failed` باشد → `failed` (تا کاربر بتواند retry-failed بزند)،
 *      • در غیر این صورت → `succeeded`.
 *
 * نکتهٔ ناوردای پایانی (Requirement 10.4): هنگام رسیدن به یک وضعیت پایانیِ
 * غیر-`cancelled`، تساوی `completed + failed + skipped = total` برقرار است (هیچ
 * `pending`/`running`/`cancelled` باقی نمی‌ماند چون مسیر cancel جداست).
 */
export function deriveJobStatus(counts: ProgressCounts): JobStatus {
  if (counts.total === 0) {
    return 'succeeded';
  }

  if (!isJobComplete(counts)) {
    const hasProgress =
      counts.running > 0 ||
      counts.completed > 0 ||
      counts.failed > 0 ||
      counts.skipped > 0 ||
      counts.cancelled > 0;
    return hasProgress ? 'running' : 'pending';
  }

  if (counts.cancelled === counts.total) {
    return 'cancelled';
  }
  if (counts.failed > 0) {
    return 'failed';
  }
  return 'succeeded';
}
