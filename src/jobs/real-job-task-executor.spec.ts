import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalyticsQueryService } from '../analytics/analytics-query.service';
import { CollectionService } from '../collection/collection.service';
import { SourcesService } from '../sources/sources.service';
import { Source } from '../sources/source.types';
import { JobTaskEntity } from './entities/job-task.entity';
import { JobService } from './jobs.service';
import { RealJobTaskExecutor } from './real-job-task-executor';

/**
 * تست واحد RealJobTaskExecutor (تسک ۷.۶ + ۱۱.۵، Requirements 1.5 / 10.1 / 15.4).
 *
 * سرویس‌های دامنه (Sources/Collection/Analysis/Analytics) و JobService mock
 * می‌شوند اما منطق واقعی مسیردهی executor آزمایش می‌شود — داده‌ای جعل نمی‌شود.
 * هدف‌ها:
 *  - `fetch`     → resolve منبع + `CollectionService.collect`.
 *  - `analyze`   → `AnalysisService.analyzeSource(sourceId, timeframe)`.
 *  - `insight`   → `AnalysisService.generateSourceInsight(sourceId)`.
 *  - `dashboard` → `AnalyticsQueryService.refreshSummaries()` (تسک ۱۱.۵).
 *  - انتشار خطا (propagation) برای fetch/analyze/insight/dashboard
 *    (ایزولاسیون در worker).
 */
describe('RealJobTaskExecutor', () => {
  let executor: RealJobTaskExecutor;
  let sourcesService: { findById: jest.Mock };
  let collectionService: { collect: jest.Mock };
  let analysisService: {
    analyzeSource: jest.Mock;
    generateSourceInsight: jest.Mock;
  };
  let analyticsQueryService: { refreshSummaries: jest.Mock };
  let jobService: { getJob: jest.Mock };

  const fakeSource = { id: 10, username: 'acme', platform: 'instagram' } as Source;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealJobTaskExecutor,
        {
          provide: SourcesService,
          useValue: { findById: jest.fn().mockResolvedValue(fakeSource) },
        },
        {
          provide: CollectionService,
          useValue: { collect: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AnalysisService,
          useValue: {
            analyzeSource: jest.fn().mockResolvedValue(undefined),
            generateSourceInsight: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AnalyticsQueryService,
          useValue: {
            refreshSummaries: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JobService,
          useValue: {
            getJob: jest.fn().mockResolvedValue({ config: null }),
          },
        },
      ],
    }).compile();

    executor = module.get(RealJobTaskExecutor);
    sourcesService = module.get(SourcesService) as unknown as typeof sourcesService;
    collectionService = module.get(
      CollectionService,
    ) as unknown as typeof collectionService;
    analysisService = module.get(
      AnalysisService,
    ) as unknown as typeof analysisService;
    analyticsQueryService = module.get(
      AnalyticsQueryService,
    ) as unknown as typeof analyticsQueryService;
    jobService = module.get(JobService) as unknown as typeof jobService;
  });

  describe('routing by task.type (Requirement 1.5)', () => {
    it('fetch → resolves the source then calls CollectionService.collect', async () => {
      const task = makeTask({ type: 'fetch', target_ref: '10' });

      await executor.executeTask(task);

      expect(sourcesService.findById).toHaveBeenCalledWith(10);
      expect(collectionService.collect).toHaveBeenCalledWith(fakeSource);
      expect(analysisService.analyzeSource).not.toHaveBeenCalled();
      expect(analysisService.generateSourceInsight).not.toHaveBeenCalled();
    });

    it('analyze → calls AnalysisService.analyzeSource with default timeframe "all"', async () => {
      const task = makeTask({ type: 'analyze', target_ref: '20' });

      await executor.executeTask(task);

      expect(analysisService.analyzeSource).toHaveBeenCalledWith(20, 'all');
      expect(collectionService.collect).not.toHaveBeenCalled();
    });

    it('analyze → derives timeframe from the parent job config when present', async () => {
      jobService.getJob.mockResolvedValue({ config: { timeframe: '7d' } });
      const task = makeTask({ type: 'analyze', target_ref: '20' });

      await executor.executeTask(task);

      expect(jobService.getJob).toHaveBeenCalledWith('job-1');
      expect(analysisService.analyzeSource).toHaveBeenCalledWith(20, '7d');
    });

    it('analyze → falls back to "all" when job config timeframe is invalid', async () => {
      jobService.getJob.mockResolvedValue({ config: { timeframe: 'bogus' } });
      const task = makeTask({ type: 'analyze', target_ref: '20' });

      await executor.executeTask(task);

      expect(analysisService.analyzeSource).toHaveBeenCalledWith(20, 'all');
    });

    it('insight → calls AnalysisService.generateSourceInsight', async () => {
      const task = makeTask({ type: 'insight', target_ref: '30' });

      await executor.executeTask(task);

      expect(analysisService.generateSourceInsight).toHaveBeenCalledWith(30);
      expect(collectionService.collect).not.toHaveBeenCalled();
    });

    it('dashboard → calls AnalyticsQueryService.refreshSummaries (no source resolution)', async () => {
      const task = makeTask({ type: 'dashboard', target_ref: '40' });

      await expect(executor.executeTask(task)).resolves.toBeUndefined();

      expect(analyticsQueryService.refreshSummaries).toHaveBeenCalledTimes(1);
      // refreshSummaries سراسری است؛ target_ref بی‌اثر و parse نمی‌شود.
      expect(sourcesService.findById).not.toHaveBeenCalled();
      expect(collectionService.collect).not.toHaveBeenCalled();
      expect(analysisService.analyzeSource).not.toHaveBeenCalled();
      expect(analysisService.generateSourceInsight).not.toHaveBeenCalled();
    });

    it('dashboard → does not parse target_ref (refresh is global, works even for invalid ref)', async () => {
      const task = makeTask({ type: 'dashboard', target_ref: 'not-a-number' });

      await expect(executor.executeTask(task)).resolves.toBeUndefined();

      expect(analyticsQueryService.refreshSummaries).toHaveBeenCalledTimes(1);
    });
  });

  describe('error propagation (Requirement 10.7 — isolation handled by worker)', () => {
    it('fetch → propagates errors from CollectionService.collect', async () => {
      collectionService.collect.mockRejectedValue(new Error('collect boom'));
      const task = makeTask({ type: 'fetch' });

      await expect(executor.executeTask(task)).rejects.toThrow('collect boom');
    });

    it('fetch → propagates errors from source resolution', async () => {
      sourcesService.findById.mockRejectedValue(new Error('not found'));
      const task = makeTask({ type: 'fetch' });

      await expect(executor.executeTask(task)).rejects.toThrow('not found');
      expect(collectionService.collect).not.toHaveBeenCalled();
    });

    it('analyze → propagates errors from AnalysisService.analyzeSource', async () => {
      analysisService.analyzeSource.mockRejectedValue(new Error('analyze boom'));
      const task = makeTask({ type: 'analyze' });

      await expect(executor.executeTask(task)).rejects.toThrow('analyze boom');
    });

    it('insight → propagates errors from AnalysisService.generateSourceInsight', async () => {
      analysisService.generateSourceInsight.mockRejectedValue(
        new Error('insight boom'),
      );
      const task = makeTask({ type: 'insight' });

      await expect(executor.executeTask(task)).rejects.toThrow('insight boom');
    });

    it('dashboard → propagates errors from AnalyticsQueryService.refreshSummaries', async () => {
      analyticsQueryService.refreshSummaries.mockRejectedValue(
        new Error('refresh boom'),
      );
      const task = makeTask({ type: 'dashboard' });

      await expect(executor.executeTask(task)).rejects.toThrow('refresh boom');
    });

    it('throws for an invalid target_ref (recorded as failed by the worker)', async () => {
      const task = makeTask({ type: 'fetch', target_ref: 'not-a-number' });

      await expect(executor.executeTask(task)).rejects.toBeDefined();
      expect(collectionService.collect).not.toHaveBeenCalled();
    });
  });
});
