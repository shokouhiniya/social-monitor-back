import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JobService } from './jobs.service';
import { JobEntity } from './entities/job.entity';
import { JobTaskEntity } from './entities/job-task.entity';
import { JobLogEntity } from './entities/job-log.entity';
import { NotFoundException } from '../common/exceptions';

/**
 * تست واحد JobService (Requirement 10.1, 10.5, 10.10).
 *
 * Repositoryها، DataSource و تراکنش mock می‌شوند اما منطق واقعی سرویس آزمایش
 * می‌شود — داده‌ای جعل نمی‌شود. تراکنش با یک manager سبک که `getRepository` را به
 * همان mockها نگاشت می‌کند شبیه‌سازی می‌شود.
 */
describe('JobService', () => {
  let service: JobService;
  let jobRepo: jest.Mocked<Repository<JobEntity>>;
  let taskRepo: jest.Mocked<Repository<JobTaskEntity>>;
  let logRepo: jest.Mocked<Repository<JobLogEntity>>;
  let dataSource: { transaction: jest.Mock };

  const makeJob = (over: Partial<JobEntity> = {}): JobEntity =>
    ({
      id: 'job-1',
      type: 'refresh',
      status: 'pending',
      scope: null,
      config: null,
      total_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      created_by: 1,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      started_at: null,
      finished_at: null,
      ...over,
    }) as JobEntity;

  const makeTask = (over: Partial<JobTaskEntity> = {}): JobTaskEntity =>
    ({
      id: 1,
      job_id: 'job-1',
      type: 'fetch',
      target_ref: '10',
      status: 'pending',
      attempts: 0,
      error_message: null,
      started_at: null,
      finished_at: null,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      ...over,
    }) as JobTaskEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: getRepositoryToken(JobEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JobTaskEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JobLogEntity),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(JobService);
    jobRepo = module.get(getRepositoryToken(JobEntity));
    taskRepo = module.get(getRepositoryToken(JobTaskEntity));
    logRepo = module.get(getRepositoryToken(JobLogEntity));
    dataSource = module.get(DataSource);

    // تراکنش: یک manager که getRepository را به همان repo mockها نگاشت می‌کند.
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === JobEntity) return jobRepo;
        if (entity === JobTaskEntity) return taskRepo;
        if (entity === JobLogEntity) return logRepo;
        throw new Error('unexpected entity in transaction');
      },
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));
  });

  describe('createRefreshJob (Requirement 10.1)', () => {
    it('fans out one task per source x step and sets total_tasks', async () => {
      jobRepo.create.mockImplementation((v) => v as JobEntity);
      jobRepo.save.mockImplementation(async (v) =>
        ({ ...(v as JobEntity), id: 'job-99' }) as JobEntity,
      );
      taskRepo.create.mockImplementation((v) => v as JobTaskEntity);
      taskRepo.save.mockImplementation(async (v) => v as JobTaskEntity);

      const result = await service.createRefreshJob(
        { sourceIds: [10, 20, 30], steps: ['fetch', 'analyze'] },
        7,
      );

      expect(result.id).toBe('job-99');
      expect(result.status).toBe('pending');
      // 3 sources × 2 steps = 6 tasks
      expect(result.total_tasks).toBe(6);
      expect(result.created_by).toBe(7);

      // taskRepo.save called once with an array of 6 tasks.
      expect(taskRepo.save).toHaveBeenCalledTimes(1);
      const savedTasks = taskRepo.save.mock.calls[0][0] as JobTaskEntity[];
      expect(savedTasks).toHaveLength(6);
      expect(savedTasks.every((t) => t.status === 'pending')).toBe(true);
      expect(savedTasks.every((t) => t.job_id === 'job-99')).toBe(true);
      // target_ref reflects the source id as a string
      expect(savedTasks.map((t) => t.target_ref)).toEqual([
        '10',
        '10',
        '20',
        '20',
        '30',
        '30',
      ]);
    });

    it('defaults steps to the full pipeline when omitted', async () => {
      jobRepo.create.mockImplementation((v) => v as JobEntity);
      jobRepo.save.mockImplementation(async (v) =>
        ({ ...(v as JobEntity), id: 'job-1' }) as JobEntity,
      );
      taskRepo.create.mockImplementation((v) => v as JobTaskEntity);
      taskRepo.save.mockImplementation(async (v) => v as JobTaskEntity);

      const result = await service.createRefreshJob({ sourceIds: [5] }, 1);

      // 1 source × 4 default steps (fetch, analyze, insight, dashboard)
      expect(result.total_tasks).toBe(4);
      const savedTasks = taskRepo.save.mock.calls[0][0] as JobTaskEntity[];
      expect(savedTasks.map((t) => t.type)).toEqual([
        'fetch',
        'analyze',
        'insight',
        'dashboard',
      ]);
    });
  });

  describe('retryFailed (Requirement 10.5)', () => {
    it('moves only failed tasks back to pending and leaves succeeded untouched', async () => {
      const tasks = [
        makeTask({ id: 1, status: 'succeeded' }),
        makeTask({ id: 2, status: 'failed', error_message: 'boom' }),
        makeTask({ id: 3, status: 'failed', error_message: 'kaboom' }),
        makeTask({ id: 4, status: 'skipped' }),
      ];
      jobRepo.findOne.mockResolvedValue(
        makeJob({ status: 'failed', total_tasks: 4, completed_tasks: 1, failed_tasks: 2 }),
      );
      taskRepo.find.mockResolvedValue(tasks);
      taskRepo.save.mockImplementation(async (v) => v as JobTaskEntity);
      jobRepo.save.mockImplementation(async (v) => v as JobEntity);

      const result = await service.retryFailed('job-1');

      // succeeded + skipped untouched
      expect(tasks[0].status).toBe('succeeded');
      expect(tasks[3].status).toBe('skipped');
      // failed -> pending, error cleared
      expect(tasks[1].status).toBe('pending');
      expect(tasks[1].error_message).toBeNull();
      expect(tasks[2].status).toBe('pending');

      // only the failed tasks are saved
      const savedFailed = taskRepo.save.mock.calls[0][0] as JobTaskEntity[];
      expect(savedFailed.map((t) => t.id).sort()).toEqual([2, 3]);

      // job recomputed: 1 succeeded, 0 failed now, has pending -> running
      expect(result.completed_tasks).toBe(1);
      expect(result.failed_tasks).toBe(0);
      expect(result.status).toBe('running');
      expect(result.finished_at).toBeNull();
    });

    it('is a no-op when there are no failed tasks (idempotent)', async () => {
      const job = makeJob({ status: 'succeeded', total_tasks: 2, completed_tasks: 2 });
      jobRepo.findOne.mockResolvedValue(job);
      taskRepo.find.mockResolvedValue([
        makeTask({ id: 1, status: 'succeeded' }),
        makeTask({ id: 2, status: 'succeeded' }),
      ]);

      const result = await service.retryFailed('job-1');

      expect(result).toBe(job);
      expect(taskRepo.save).not.toHaveBeenCalled();
      expect(jobRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing job', async () => {
      jobRepo.findOne.mockResolvedValue(null);
      await expect(service.retryFailed('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cancel (Requirement 10.10)', () => {
    it('moves pending tasks to cancelled and stops the job', async () => {
      const tasks = [
        makeTask({ id: 1, status: 'pending' }),
        makeTask({ id: 2, status: 'running' }),
        makeTask({ id: 3, status: 'succeeded' }),
        makeTask({ id: 4, status: 'pending' }),
      ];
      jobRepo.findOne.mockResolvedValue(
        makeJob({ status: 'running', total_tasks: 4, completed_tasks: 1 }),
      );
      taskRepo.find.mockResolvedValue(tasks);
      taskRepo.save.mockImplementation(async (v) => v as JobTaskEntity);
      jobRepo.save.mockImplementation(async (v) => v as JobEntity);

      const result = await service.cancel('job-1');

      // pending -> cancelled
      expect(tasks[0].status).toBe('cancelled');
      expect(tasks[3].status).toBe('cancelled');
      // running and succeeded untouched (isolation)
      expect(tasks[1].status).toBe('running');
      expect(tasks[2].status).toBe('succeeded');

      expect(result.status).toBe('cancelled');
      expect(result.finished_at).not.toBeNull();
    });

    it('is idempotent when the job is already cancelled', async () => {
      const job = makeJob({ status: 'cancelled' });
      jobRepo.findOne.mockResolvedValue(job);

      const result = await service.cancel('job-1');

      expect(result).toBe(job);
      expect(taskRepo.save).not.toHaveBeenCalled();
      expect(jobRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing job', async () => {
      jobRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getJob (Requirement 10.8)', () => {
    it('returns status, progress, failedTasks and logs', async () => {
      jobRepo.findOne.mockResolvedValue(
        makeJob({ status: 'failed', total_tasks: 3, completed_tasks: 1, failed_tasks: 1 }),
      );
      taskRepo.find.mockResolvedValue([
        makeTask({ id: 1, status: 'succeeded' }),
        makeTask({ id: 2, status: 'failed', error_message: 'oops' }),
        makeTask({ id: 3, status: 'skipped' }),
      ]);
      logRepo.find.mockResolvedValue([
        {
          id: 1,
          job_id: 'job-1',
          level: 'error',
          message: 'task 2 failed',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
        } as JobLogEntity,
      ]);

      const detail = await service.getJob('job-1');

      expect(detail.status).toBe('failed');
      expect(detail.progress.total).toBe(3);
      expect(detail.progress.completed).toBe(1);
      expect(detail.progress.failed).toBe(1);
      expect(detail.failedTasks).toHaveLength(1);
      expect(detail.failedTasks[0].id).toBe(2);
      expect(detail.failedTasks[0].error_message).toBe('oops');
      expect(detail.logs).toHaveLength(1);
      expect(detail.logs[0].level).toBe('error');
    });

    it('throws NotFoundException for a missing job', async () => {
      jobRepo.findOne.mockResolvedValue(null);
      await expect(service.getJob('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('listJobs (Requirement 12.5-12.7)', () => {
    it('returns a paginated summary honoring the contract', async () => {
      jobRepo.findAndCount.mockResolvedValue([
        [makeJob({ id: 'a' }), makeJob({ id: 'b' })],
        2,
      ]);

      const result = await service.listJobs({ page: 1, pageSize: 20 });

      expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(2);
      expect(result.items.length).toBeLessThanOrEqual(result.pageSize);
      expect(result.items[0]).toHaveProperty('progress');
    });
  });

  describe('worker helpers', () => {
    it('markTaskRunning transitions pending -> running and bumps attempts', async () => {
      const task = makeTask({ id: 5, status: 'pending', attempts: 0 });
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockImplementation(async (v) => v as JobTaskEntity);

      const result = await service.markTaskRunning(5);

      expect(result.status).toBe('running');
      expect(result.attempts).toBe(1);
      expect(result.started_at).not.toBeNull();
    });

    it('markTaskFailed records error_message and appends an error log', async () => {
      const task = makeTask({ id: 6, status: 'running' });
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockImplementation(async (v) => v as JobTaskEntity);
      logRepo.create.mockImplementation((v) => v as JobLogEntity);
      logRepo.save.mockImplementation(async (v) => v as JobLogEntity);

      const result = await service.markTaskFailed(6, 'network down');

      expect(result.status).toBe('failed');
      expect(result.error_message).toBe('network down');
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.save.mock.calls[0][0] as JobLogEntity;
      expect(log.level).toBe('error');
    });
  });
});
