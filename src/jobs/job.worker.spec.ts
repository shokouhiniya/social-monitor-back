import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JobWorker } from './job.worker';
import { JobService } from './jobs.service';
import {
  JOB_TASK_EXECUTOR,
  JobTaskExecutor,
} from './job-task-executor';
import { JobTaskEntity } from './entities/job-task.entity';

/**
 * تست واحد JobWorker (Requirements 10.6, 10.7, 10.9).
 *
 * `JobService` و executor و `ConfigService` mock می‌شوند اما منطق واقعی worker
 * (حلقهٔ claim، ایزولاسیون خطا و بازمحاسبهٔ پیشرفت) آزمایش می‌شود — داده‌ای جعل
 * نمی‌شود. claim اتمیک با `FOR UPDATE SKIP LOCKED` در سطح `JobService` است؛ اینجا
 * رفتار مصرف‌کنندهٔ آن (worker) تست می‌شود.
 */
describe('JobWorker', () => {
  let worker: JobWorker;
  let jobService: {
    claimNextPendingTask: jest.Mock;
    markTaskSucceeded: jest.Mock;
    markTaskFailed: jest.Mock;
    recomputeProgress: jest.Mock;
  };
  let executor: { executeTask: jest.Mock };
  let configValue: Record<string, unknown>;

  const makeTask = (over: Partial<JobTaskEntity> = {}): JobTaskEntity =>
    ({
      id: 1,
      job_id: 'job-1',
      type: 'fetch',
      target_ref: '10',
      status: 'running',
      attempts: 1,
      error_message: null,
      started_at: new Date('2024-01-01T00:00:00.000Z'),
      finished_at: null,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      ...over,
    }) as JobTaskEntity;

  beforeEach(async () => {
    configValue = { jobs: { concurrency: 3, enabled: false, pollIntervalMs: 1000 } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobWorker,
        {
          provide: JobService,
          useValue: {
            claimNextPendingTask: jest.fn(),
            markTaskSucceeded: jest.fn().mockResolvedValue(undefined),
            markTaskFailed: jest.fn().mockResolvedValue(undefined),
            recomputeProgress: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JOB_TASK_EXECUTOR,
          useValue: { executeTask: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValue[key]),
          },
        },
      ],
    }).compile();

    worker = module.get(JobWorker);
    jobService = module.get(JobService) as unknown as typeof jobService;
    executor = module.get(JOB_TASK_EXECUTOR) as unknown as typeof executor;
  });

  describe('concurrency config (Requirement 10.9)', () => {
    it('reads concurrency from settings', () => {
      expect(worker.concurrency).toBe(3);
    });

    it('falls back to the safe default when config is missing', () => {
      configValue = {};
      expect(worker.concurrency).toBe(5);
    });

    it('falls back to the safe default when concurrency is invalid', () => {
      configValue = { jobs: { concurrency: 0, enabled: false, pollIntervalMs: 1000 } };
      expect(worker.concurrency).toBe(5);
    });
  });

  describe('processNext — claim + execute (Requirement 10.6)', () => {
    it('returns false and does nothing when no task is claimable', async () => {
      jobService.claimNextPendingTask.mockResolvedValue(null);

      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(executor.executeTask).not.toHaveBeenCalled();
      expect(jobService.markTaskSucceeded).not.toHaveBeenCalled();
      expect(jobService.recomputeProgress).not.toHaveBeenCalled();
    });

    it('executes a claimed task, marks it succeeded and recomputes progress', async () => {
      const task = makeTask({ id: 42, job_id: 'job-7' });
      jobService.claimNextPendingTask.mockResolvedValue(task);

      const result = await worker.processNext();

      expect(result).toBe(true);
      expect(executor.executeTask).toHaveBeenCalledWith(task);
      expect(jobService.markTaskSucceeded).toHaveBeenCalledWith(42);
      expect(jobService.markTaskFailed).not.toHaveBeenCalled();
      expect(jobService.recomputeProgress).toHaveBeenCalledWith('job-7');
    });
  });

  describe('error isolation (Requirement 10.7)', () => {
    it('marks a throwing task failed (with message) and still recomputes progress', async () => {
      const task = makeTask({ id: 9, job_id: 'job-3' });
      jobService.claimNextPendingTask.mockResolvedValue(task);
      executor.executeTask.mockRejectedValue(new Error('boom'));

      const result = await worker.processNext();

      expect(result).toBe(true);
      expect(jobService.markTaskFailed).toHaveBeenCalledWith(9, 'boom');
      expect(jobService.markTaskSucceeded).not.toHaveBeenCalled();
      // پیشرفت حتی پس از شکست بازمحاسبه می‌شود.
      expect(jobService.recomputeProgress).toHaveBeenCalledWith('job-3');
    });

    it('does not abort the loop — one failing task, the rest continue (tick)', async () => {
      const t1 = makeTask({ id: 1, job_id: 'job-1' });
      const t2 = makeTask({ id: 2, job_id: 'job-1' });
      const t3 = makeTask({ id: 3, job_id: 'job-1' });
      // سه task سپس صف خالی (null) برای پایان موج.
      jobService.claimNextPendingTask
        .mockResolvedValueOnce(t1)
        .mockResolvedValueOnce(t2)
        .mockResolvedValueOnce(t3)
        .mockResolvedValue(null);
      // فقط task دوم خطا می‌دهد.
      executor.executeTask.mockImplementation(async (t: JobTaskEntity) => {
        if (t.id === 2) {
          throw new Error('task 2 failed');
        }
      });

      const processed = await worker.tick();

      expect(processed).toBe(3);
      // task های ۱ و ۳ موفق، task ۲ ناموفق — حلقه متوقف نشد.
      expect(jobService.markTaskSucceeded).toHaveBeenCalledWith(1);
      expect(jobService.markTaskSucceeded).toHaveBeenCalledWith(3);
      expect(jobService.markTaskFailed).toHaveBeenCalledWith(2, 'task 2 failed');
      // پیشرفت برای هر سه task بازمحاسبه شد.
      expect(jobService.recomputeProgress).toHaveBeenCalledTimes(3);
    });

    it('continues the loop even when markTaskFailed itself throws', async () => {
      const task = makeTask({ id: 5, job_id: 'job-5' });
      jobService.claimNextPendingTask.mockResolvedValue(task);
      executor.executeTask.mockRejectedValue(new Error('exec error'));
      jobService.markTaskFailed.mockRejectedValue(new Error('persist error'));

      // نباید throw کند — خطا ایزوله می‌شود.
      await expect(worker.processNext()).resolves.toBe(true);
      // پیشرفت همچنان تلاش می‌شود.
      expect(jobService.recomputeProgress).toHaveBeenCalledWith('job-5');
    });
  });

  describe('tick — drains the pending queue', () => {
    it('claims tasks until the queue is empty', async () => {
      const tasks = [
        makeTask({ id: 1 }),
        makeTask({ id: 2 }),
        makeTask({ id: 3 }),
        makeTask({ id: 4 }),
      ];
      let i = 0;
      jobService.claimNextPendingTask.mockImplementation(async () =>
        i < tasks.length ? tasks[i++] : null,
      );

      const processed = await worker.tick();

      expect(processed).toBe(4);
      expect(executor.executeTask).toHaveBeenCalledTimes(4);
    });

    it('returns 0 when there are no pending tasks', async () => {
      jobService.claimNextPendingTask.mockResolvedValue(null);

      const processed = await worker.tick();

      expect(processed).toBe(0);
      expect(executor.executeTask).not.toHaveBeenCalled();
    });
  });
});
