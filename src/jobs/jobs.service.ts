import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import {
  InvalidStateTransitionException,
  NotFoundException,
} from '../common/exceptions';
import {
  normalizePagination,
  paginate,
  Paginated,
} from '../common/pagination';
import { JobEntity } from './entities/job.entity';
import { JobTaskEntity } from './entities/job-task.entity';
import { JobLogEntity } from './entities/job-log.entity';
import { JobQuery, RefreshJobDto } from './jobs.dto';
import {
  allowedJobTargets,
  allowedTaskTargets,
  canTransitionJob,
  canTransitionTask,
  computeProgress,
  deriveJobStatus,
  JOB_INITIAL_STATUS,
  JobStatus,
  JobTaskStatus,
} from './job-state-machine';
import {
  JobDetail,
  JobLogLevel,
  JobProgress,
  JobScope,
  JobSummary,
  JobTaskSummary,
  JobTaskType,
  JOB_TASK_TYPES,
  JOB_TYPE_REFRESH,
} from './jobs.types';

/**
 * مراحل پیش‌فرض یک Job بروزرسانی در صورت ارائه‌نشدن `steps` (design §5.11).
 */
export const DEFAULT_REFRESH_STEPS: JobTaskType[] = [...JOB_TASK_TYPES];

/**
 * JobService — هستهٔ Job Center پایدار (design §5.11 / §9.4، Requirement 10).
 *
 * مسئولیت‌ها:
 *  - `createRefreshJob` : ثبت یک `job` (وضعیت `pending`) و fan-out به `job_tasks`
 *    (یک task به‌ازای هر منبع × هر مرحله) در یک تراکنش (Requirement 10.1).
 *  - `getJob`           : بازگرداندن وضعیت + پیشرفت + task های ناموفق + لاگ‌ها
 *    (Requirement 10.8).
 *  - `listJobs`         : فهرست صفحه‌بندی‌شدهٔ Job ها (Requirement 12.5-12.7).
 *  - `cancel`           : لغو Job — انتقال task های `pending` به `cancelled` و
 *    توقف Job (Requirement 10.10).
 *  - `retryFailed`      : بازگرداندن **فقط** task های `failed` به `pending`،
 *    دست‌نخورده ماندن task های `succeeded` (idempotent — Requirement 10.5).
 *
 * گذارهای وضعیت task/job از طریق ماشین وضعیت خالص `job-state-machine.ts`
 * اعتبارسنجی می‌شوند (Requirement 10.3) و ناوردای پیشرفت
 * `completed + failed ≤ total` در `recomputeProgress` حفظ می‌شود (Requirement 10.4).
 *
 * متدهای کمکی worker (تسک ۷.۴): `claimNextPendingTask` (claim اتمیک با
 * `FOR UPDATE SKIP LOCKED`)، `markTaskRunning`, `markTaskSucceeded`,
 * `markTaskFailed`, `appendLog`, `recomputeProgress` اینجا تعریف شده‌اند و توسط
 * `JobWorker` مصرف می‌شوند.
 */
@Injectable()
export class JobService {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(JobTaskEntity)
    private readonly taskRepository: Repository<JobTaskEntity>,
    @InjectRepository(JobLogEntity)
    private readonly logRepository: Repository<JobLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /* ---------------------------------------------------------------- */
  /* عملیات عمومی (public interface — design §5.11)                    */
  /* ---------------------------------------------------------------- */

  /**
   * ساخت یک Job بروزرسانی با fan-out به task ها (Requirement 10.1).
   *
   * یک رکورد `jobs` با وضعیت اولیهٔ `pending` و `total_tasks = sourceIds × steps`
   * ثبت می‌شود و به‌ازای هر (منبع، مرحله) یک `job_tasks` با همان وضعیت اولیه و
   * `target_ref = sourceId` ساخته می‌شود. هر دو نوشتن داخل **یک تراکنش** انجام
   * می‌شوند تا job بدون task (یا بالعکس) باقی نماند.
   */
  async createRefreshJob(dto: RefreshJobDto, userId: number): Promise<JobEntity> {
    const steps =
      dto.steps && dto.steps.length > 0 ? dto.steps : DEFAULT_REFRESH_STEPS;
    const sourceIds = dto.sourceIds;
    const totalTasks = sourceIds.length * steps.length;

    const config: JobScope = { sourceIds, steps };

    return this.dataSource.transaction(async (manager) => {
      const jobRepo = manager.getRepository(JobEntity);
      const taskRepo = manager.getRepository(JobTaskEntity);

      const job = jobRepo.create({
        type: JOB_TYPE_REFRESH,
        status: JOB_INITIAL_STATUS,
        scope: null,
        config,
        total_tasks: totalTasks,
        completed_tasks: 0,
        failed_tasks: 0,
        created_by: userId ?? null,
        started_at: null,
        finished_at: null,
      });
      const savedJob = await jobRepo.save(job);

      const tasks: JobTaskEntity[] = [];
      for (const sourceId of sourceIds) {
        for (const step of steps) {
          tasks.push(
            taskRepo.create({
              job_id: savedJob.id,
              type: step,
              target_ref: String(sourceId),
              status: JOB_INITIAL_STATUS,
              attempts: 0,
              error_message: null,
              started_at: null,
              finished_at: null,
            }),
          );
        }
      }

      if (tasks.length > 0) {
        await taskRepo.save(tasks);
      }

      return savedJob;
    });
  }

  /**
   * بازگرداندن نمای کامل یک Job: وضعیت + پیشرفت + task های ناموفق + لاگ‌ها
   * (Requirement 10.8). در صورت نبود Job، `NotFoundException`.
   */
  async getJob(id: string): Promise<JobDetail> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Job با شناسهٔ ${id} یافت نشد`);
    }

    const [tasks, logs] = await Promise.all([
      this.taskRepository.find({
        where: { job_id: id },
        order: { id: 'ASC' },
      }),
      this.logRepository.find({
        where: { job_id: id },
        order: { id: 'ASC' },
      }),
    ]);

    const counts = computeProgress(
      tasks.map((t) => t.status),
      job.total_tasks,
    );

    const failedTasks: JobTaskSummary[] = tasks
      .filter((t) => t.status === 'failed')
      .map((t) => this.toTaskSummary(t));

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      scope: job.scope,
      config: job.config,
      progress: this.toProgress(counts.total, counts.completed, counts.failed),
      failedTasks,
      logs: logs.map((l) => ({
        id: l.id,
        level: l.level,
        message: l.message,
        created_at: l.created_at,
      })),
      created_by: job.created_by,
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
    };
  }

  /** فهرست صفحه‌بندی‌شدهٔ Job ها (Requirement 12.5-12.7). */
  async listJobs(query: JobQuery): Promise<Paginated<JobSummary>> {
    const pagination = normalizePagination(query);

    const where: FindOptionsWhere<JobEntity> = {};
    if (query.status) {
      where.status = query.status as JobStatus;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [items, total] = await this.jobRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items.map((j) => this.toSummary(j)), total, pagination);
  }

  /**
   * لغو یک Job (Requirement 10.10): همهٔ task های `pending` به `cancelled` منتقل و
   * Job متوقف می‌شود.
   *
   * Atomicity: گذار وضعیت Job پیش از persist با ماشین وضعیت بررسی می‌شود؛ تنها
   * Job های در وضعیت `pending`/`running` قابل لغو‌اند. لغو یک Job که از قبل
   * `cancelled` است idempotent است (همان Job بازگردانده می‌شود). task های
   * `running` که worker قبلاً claim کرده دست‌نخورده می‌مانند (ایزولاسیون) و چون
   * هیچ task جدیدی `pending` نمی‌ماند، کار جدیدی آغاز نمی‌شود.
   */
  async cancel(id: string): Promise<JobEntity> {
    return this.dataSource.transaction(async (manager) => {
      const jobRepo = manager.getRepository(JobEntity);
      const taskRepo = manager.getRepository(JobTaskEntity);

      const job = await jobRepo.findOne({ where: { id } });
      if (!job) {
        throw new NotFoundException(`Job با شناسهٔ ${id} یافت نشد`);
      }

      // idempotent: لغو یک Job از قبل لغوشده، بدون تغییر.
      if (job.status === 'cancelled') {
        return job;
      }

      if (!canTransitionJob(job.status, 'cancelled')) {
        throw new InvalidStateTransitionException(
          `لغو Job در وضعیت «${job.status}» مجاز نیست`,
          {
            entity: 'Job',
            from: job.status,
            to: 'cancelled',
            allowed: allowedJobTargets(job.status),
          },
        );
      }

      const tasks = await taskRepo.find({ where: { job_id: id } });
      const now = new Date();
      for (const task of tasks) {
        if (task.status === 'pending') {
          task.status = 'cancelled';
          task.finished_at = now;
        }
      }
      const pendingCancelled = tasks.filter(
        (t) => t.status === 'cancelled' && t.finished_at === now,
      );
      if (pendingCancelled.length > 0) {
        await taskRepo.save(pendingCancelled);
      }

      // شمارش‌ها از روی وضعیت نهایی task ها بازمحاسبه می‌شوند تا ناوردای پیشرفت
      // حفظ شود (Requirement 10.4)، اما وضعیت Job صریحاً `cancelled` می‌شود تا
      // نیت کاربر بازتاب یابد (Requirement 10.10).
      const counts = computeProgress(
        tasks.map((t) => t.status),
        job.total_tasks,
      );
      job.completed_tasks = counts.completed;
      job.failed_tasks = counts.failed;
      job.status = 'cancelled';
      job.finished_at = now;

      return jobRepo.save(job);
    });
  }

  /**
   * تلاش مجدد فقط روی task های `failed` (Requirement 10.5).
   *
   * تنها task هایی که وضعیت `failed` دارند به `pending` بازمی‌گردند؛ task های
   * `succeeded` (و هر وضعیت دیگری) دست‌نخورده می‌مانند. در نتیجه فراخوانی مکرر
   * `retryFailed` نسبت به task های موفق idempotent است و هرگز کار موفق را تکرار
   * نمی‌کند. اگر هیچ task ناموفقی نباشد، Job بدون تغییر بازگردانده می‌شود.
   */
  async retryFailed(id: string): Promise<JobEntity> {
    return this.dataSource.transaction(async (manager) => {
      const jobRepo = manager.getRepository(JobEntity);
      const taskRepo = manager.getRepository(JobTaskEntity);

      const job = await jobRepo.findOne({ where: { id } });
      if (!job) {
        throw new NotFoundException(`Job با شناسهٔ ${id} یافت نشد`);
      }

      const tasks = await taskRepo.find({ where: { job_id: id } });
      const failed = tasks.filter((t) => t.status === 'failed');

      // بدون task ناموفق: no-op idempotent.
      if (failed.length === 0) {
        return job;
      }

      for (const task of failed) {
        // گذار failed → pending تنها از این مسیر مجاز است (Requirement 10.3).
        if (!canTransitionTask(task.status, 'pending')) {
          throw new InvalidStateTransitionException(
            `بازگردانی task #${task.id} از «${task.status}» به «pending» مجاز نیست`,
            {
              entity: 'JobTask',
              from: task.status,
              to: 'pending',
              allowed: allowedTaskTargets(task.status),
            },
          );
        }
        task.status = 'pending';
        task.error_message = null;
        task.started_at = null;
        task.finished_at = null;
      }
      await taskRepo.save(failed);

      // بازمحاسبهٔ شمارش‌ها و وضعیت Job از روی وضعیت جدید task ها. چون اکنون
      // task های `pending` وجود دارند، Job از وضعیت پایانی به `running`/`pending`
      // بازگشایی می‌شود و `finished_at` پاک می‌شود.
      const counts = computeProgress(
        tasks.map((t) => t.status),
        job.total_tasks,
      );
      job.completed_tasks = counts.completed;
      job.failed_tasks = counts.failed;
      job.status = deriveJobStatus(counts);
      job.finished_at = null;

      return jobRepo.save(job);
    });
  }

  /* ---------------------------------------------------------------- */
  /* متدهای کمکی worker (تسک ۷.۴ مصرف می‌کند)                          */
  /* ---------------------------------------------------------------- */

  /**
   * claim اتمیک task بعدیِ `pending` و بردن آن به `running` در **یک تراکنش**
   * (Requirement 10.6).
   *
   * گام اول با SQL خام `SELECT id ... FOR UPDATE SKIP LOCKED` یک ردیف `pending` را
   * قفل می‌کند؛ ردیف‌هایی که توسط worker دیگری قفل شده‌اند رد می‌شوند (`SKIP
   * LOCKED`) تا دو worker هرگز یک task را هم‌زمان برندارند. سپس در همان تراکنش،
   * گذار `pending → running` (با ماشین وضعیت اعتبارسنجی‌شده) اعمال، `attempts`
   * افزایش و `started_at` ثبت می‌شود. در صورت نبود task قابل‌claim، `null`
   * بازگردانده می‌شود.
   *
   * چون claim و mark-running در یک تراکنش‌اند، با commit شدن، task در وضعیت
   * `running` و قفلِ ردیف آزاد است؛ بنابراین برای worker های دیگر دیگر `pending`
   * نیست و دوباره claim نمی‌شود (atomicity).
   */
  async claimNextPendingTask(): Promise<JobTaskEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      // قفل یک ردیف pending با پرش از ردیف‌های قفل‌شدهٔ worker های دیگر.
      const rows: Array<{ id: number }> = await manager.query(
        `SELECT id FROM job_tasks WHERE status = $1 ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        ['pending'],
      );
      if (!rows || rows.length === 0) {
        return null;
      }

      const taskRepo = manager.getRepository(JobTaskEntity);
      const task = await taskRepo.findOne({ where: { id: rows[0].id } });
      if (!task) {
        return null;
      }

      // گذار pending → running (Requirement 10.3). در عمل ردیف قفل‌شده هنوز pending
      // است؛ این بررسی صرفاً ناوردای ماشین وضعیت را تضمین می‌کند.
      if (!canTransitionTask(task.status, 'running')) {
        return null;
      }
      task.status = 'running';
      task.attempts += 1;
      task.started_at = new Date();
      return taskRepo.save(task);
    });
  }

  /** ثبت یک رکورد لاگ برای یک Job (Requirement 10.7/10.8). */
  async appendLog(
    jobId: string,
    level: JobLogLevel,
    message: string,
  ): Promise<JobLogEntity> {
    const log = this.logRepository.create({
      job_id: jobId,
      level,
      message,
    });
    return this.logRepository.save(log);
  }

  /**
   * گذار یک task به `running` (pending → running، Requirement 10.3). شمارندهٔ
   * `attempts` افزایش می‌یابد و `started_at` ثبت می‌شود.
   */
  async markTaskRunning(taskId: number): Promise<JobTaskEntity> {
    const task = await this.requireTask(taskId);
    this.assertTaskTransition(task, 'running');
    task.status = 'running';
    task.attempts += 1;
    task.started_at = new Date();
    return this.taskRepository.save(task);
  }

  /** گذار یک task به `succeeded` (running → succeeded، Requirement 10.3). */
  async markTaskSucceeded(taskId: number): Promise<JobTaskEntity> {
    const task = await this.requireTask(taskId);
    this.assertTaskTransition(task, 'succeeded');
    task.status = 'succeeded';
    task.error_message = null;
    task.finished_at = new Date();
    return this.taskRepository.save(task);
  }

  /**
   * گذار یک task به `failed` با ثبت `error_message` و یک `job_log` سطح `error`
   * (ایزولاسیون خطا — Requirement 10.7). اجرای بقیهٔ task ها توسط worker ادامه
   * می‌یابد.
   */
  async markTaskFailed(
    taskId: number,
    errorMessage: string,
  ): Promise<JobTaskEntity> {
    const task = await this.requireTask(taskId);
    this.assertTaskTransition(task, 'failed');
    task.status = 'failed';
    task.error_message = errorMessage;
    task.finished_at = new Date();
    const saved = await this.taskRepository.save(task);
    await this.appendLog(
      task.job_id,
      'error',
      `task #${task.id} (${task.type}) شکست خورد: ${errorMessage}`,
    );
    return saved;
  }

  /**
   * بازمحاسبهٔ پیشرفت و وضعیت یک Job از روی وضعیت task های آن (Requirement 10.4).
   *
   * این متد منبعِ حقیقتِ شمارش‌ها و وضعیت مشتق‌شدهٔ Job است و توسط worker پس از هر
   * تغییر وضعیت task فراخوانی می‌شود. منطق محاسبه خالص است (`computeProgress` +
   * `deriveJobStatus`) و ناوردای `completed + failed ≤ total` را تضمین می‌کند.
   * `started_at`/`finished_at` بر اساس وضعیت مشتق‌شده به‌روزرسانی می‌شوند.
   */
  async recomputeProgress(jobId: string): Promise<JobEntity> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Job با شناسهٔ ${jobId} یافت نشد`);
    }

    const tasks = await this.taskRepository.find({ where: { job_id: jobId } });
    const counts = computeProgress(
      tasks.map((t) => t.status),
      job.total_tasks,
    );

    job.completed_tasks = counts.completed;
    job.failed_tasks = counts.failed;

    const derived = deriveJobStatus(counts);
    // فقط در صورتی وضعیت را به‌روزرسانی کن که Job صریحاً `cancelled` نشده باشد
    // (cancel نیت نهاییِ کاربر است و توسط recompute بازنویسی نمی‌شود).
    if (job.status !== 'cancelled') {
      job.status = derived;
    }

    const now = new Date();
    if (
      (job.status === 'running' || derived === 'running') &&
      !job.started_at
    ) {
      job.started_at = now;
    }
    if (
      job.status === 'succeeded' ||
      job.status === 'failed' ||
      job.status === 'cancelled'
    ) {
      if (!job.finished_at) {
        job.finished_at = now;
      }
    } else {
      job.finished_at = null;
    }

    return this.jobRepository.save(job);
  }

  /* ---------------------------------------------------------------- */
  /* کمکی‌های خصوصی                                                    */
  /* ---------------------------------------------------------------- */

  private async requireTask(taskId: number): Promise<JobTaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`JobTask با شناسهٔ ${taskId} یافت نشد`);
    }
    return task;
  }

  private assertTaskTransition(
    task: JobTaskEntity,
    to: JobTaskStatus,
  ): void {
    if (!canTransitionTask(task.status, to)) {
      throw new InvalidStateTransitionException(
        `گذار task #${task.id} از «${task.status}» به «${to}» مجاز نیست`,
        {
          entity: 'JobTask',
          from: task.status,
          to,
          allowed: allowedTaskTargets(task.status),
        },
      );
    }
  }

  private toProgress(
    total: number,
    completed: number,
    failed: number,
  ): JobProgress {
    const percent =
      total > 0 ? Math.round(((completed + failed) / total) * 100) : 100;
    return { total, completed, failed, percent };
  }

  private toSummary(job: JobEntity): JobSummary {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      scope: job.scope,
      progress: this.toProgress(
        job.total_tasks,
        job.completed_tasks,
        job.failed_tasks,
      ),
      created_by: job.created_by,
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
    };
  }

  private toTaskSummary(task: JobTaskEntity): JobTaskSummary {
    return {
      id: task.id,
      type: task.type,
      target_ref: task.target_ref,
      status: task.status,
      attempts: task.attempts,
      error_message: task.error_message,
    };
  }
}
