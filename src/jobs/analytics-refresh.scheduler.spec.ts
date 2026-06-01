import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsQueryService } from '../analytics/analytics-query.service';
import {
  DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS,
  JobsConfig,
} from '../config/jobs.config';
import { AnalyticsRefreshScheduler } from './analytics-refresh.scheduler';

/**
 * تست واحد AnalyticsRefreshScheduler (تسک ۱۱.۵، Requirement 15.4 / 8.6).
 *
 * `AnalyticsQueryService` mock می‌شود (refreshSummaries فقط رصد می‌شود) و منطق
 * trigger دورهٔ‌ای آزمایش می‌گردد. هدف‌ها:
 *  - `triggerRefresh()` متد `refreshSummaries` را فراخوانی می‌کند.
 *  - در `NODE_ENV==='test'` حلقه به‌صورت خودکار آغاز نمی‌شود (تایمری ساخته نمی‌شود).
 *  - خطای `refreshSummaries` بلعیده می‌شود (ایزولاسیون — حلقه نمی‌شکند).
 */
describe('AnalyticsRefreshScheduler', () => {
  let scheduler: AnalyticsRefreshScheduler;
  let analyticsQueryService: { refreshSummaries: jest.Mock };

  const jobsConfig: JobsConfig = {
    concurrency: 5,
    enabled: false,
    pollIntervalMs: 1000,
    // فعال تا بتوان «عدم اجرا در محیط تست» را علی‌رغم enabled=true اثبات کرد.
    analyticsRefreshEnabled: true,
    analyticsRefreshIntervalMs: DEFAULT_ANALYTICS_REFRESH_INTERVAL_MS,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRefreshScheduler,
        {
          provide: AnalyticsQueryService,
          useValue: { refreshSummaries: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jobsConfig) },
        },
      ],
    }).compile();

    scheduler = module.get(AnalyticsRefreshScheduler);
    analyticsQueryService = module.get(
      AnalyticsQueryService,
    ) as unknown as typeof analyticsQueryService;
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('triggerRefresh → calls AnalyticsQueryService.refreshSummaries', async () => {
    const ran = await scheduler.triggerRefresh();

    expect(ran).toBe(true);
    expect(analyticsQueryService.refreshSummaries).toHaveBeenCalledTimes(1);
  });

  it('does not auto-start the periodic loop in NODE_ENV=test', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    // NODE_ENV در محیط jest برابر 'test' است؛ علی‌رغم enabled=true نباید آغاز شود.
    expect(process.env.NODE_ENV).toBe('test');
    scheduler.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(analyticsQueryService.refreshSummaries).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });

  it('triggerRefresh → swallows errors from refreshSummaries (isolation)', async () => {
    analyticsQueryService.refreshSummaries.mockRejectedValueOnce(
      new Error('refresh boom'),
    );

    await expect(scheduler.triggerRefresh()).resolves.toBe(true);
    expect(analyticsQueryService.refreshSummaries).toHaveBeenCalledTimes(1);
  });
});
