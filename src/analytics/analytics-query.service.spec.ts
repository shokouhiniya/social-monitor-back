import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ValidationException } from '../common/exceptions';
import { AnalyticsQueryService } from './analytics-query.service';
import { ClusterDailyMetricEntity } from './entities/cluster-daily-metric.entity';
import { KeywordDailyMetricEntity } from './entities/keyword-daily-metric.entity';
import { NetworkDailyMetricEntity } from './entities/network-daily-metric.entity';
import { SourceDailyMetricEntity } from './entities/source-daily-metric.entity';

/**
 * تست واحد AnalyticsQueryService (design §5.9، Requirement 8.1-8.6 / 1.3 / 15.3).
 *
 * تأکید این تست‌ها بر **فقط‌خواندنی بودن** و **منبع داده** است:
 *  - متدهای query تنها از repository های جدول‌های summary `*_daily_metrics`
 *    می‌خوانند (نه از query خام سنگین) — Requirement 8.2-8.5 / 15.3.
 *  - هیچ collaborator مربوط به fetch یا LLM به سرویس تزریق نشده و سرویس به
 *    `SourcesService` وابسته نیست — Requirement 8.1 / 1.3.
 *  - تنها `refreshSummaries` می‌نویسد و آن هم صرفاً از طریق تراکنش `DataSource`
 *    روی جدول‌های summary (با SQL پارامتری) — Requirement 8.6.
 *
 * repository ها و `DataSource` mock می‌شوند تا منطق تجمیع بدون دیتابیس واقعی
 * راستی‌آزمایی شود.
 */
describe('AnalyticsQueryService', () => {
  let service: AnalyticsQueryService;

  // سازندهٔ یک query builder زنجیره‌ای قابل‌تنظیم برای mock کردن خروجی raw.
  const makeQb = (raw: {
    rawOne?: unknown;
    rawMany?: unknown[];
    entityOne?: unknown;
    entityMany?: unknown[];
  }) => {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb.select = jest.fn(chain);
    qb.addSelect = jest.fn(chain);
    qb.where = jest.fn(chain);
    qb.andWhere = jest.fn(chain);
    qb.groupBy = jest.fn(chain);
    qb.orderBy = jest.fn(chain);
    qb.addOrderBy = jest.fn(chain);
    qb.limit = jest.fn(chain);
    qb.getRawOne = jest.fn().mockResolvedValue(raw.rawOne);
    qb.getRawMany = jest.fn().mockResolvedValue(raw.rawMany ?? []);
    qb.getOne = jest.fn().mockResolvedValue(raw.entityOne ?? null);
    qb.getMany = jest.fn().mockResolvedValue(raw.entityMany ?? []);
    return qb;
  };

  // repository های mock — هر کدام createQueryBuilder قابل‌برنامه‌ریزی دارند.
  const networkRepo = { createQueryBuilder: jest.fn() };
  const sourceRepo = { createQueryBuilder: jest.fn() };
  const keywordRepo = { createQueryBuilder: jest.fn() };
  const clusterRepo = { createQueryBuilder: jest.fn() };

  // DataSource mock — transaction یک manager با query mock فراهم می‌کند.
  const managerQuery = jest.fn().mockResolvedValue(undefined);
  const dataSource = {
    transaction: jest.fn(
      async (cb: (m: { query: jest.Mock }) => Promise<void>) =>
        cb({ query: managerQuery }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsQueryService,
        { provide: getRepositoryToken(NetworkDailyMetricEntity), useValue: networkRepo },
        { provide: getRepositoryToken(SourceDailyMetricEntity), useValue: sourceRepo },
        { provide: getRepositoryToken(KeywordDailyMetricEntity), useValue: keywordRepo },
        { provide: getRepositoryToken(ClusterDailyMetricEntity), useValue: clusterRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AnalyticsQueryService);
  });

  describe('getMacroDashboard (Requirement 8.2 / 15.3)', () => {
    it('reads only from the network summary repository and returns aggregates', async () => {
      // اولین createQueryBuilder برای آخرین تاریخ، دومی برای تجمیع آن روز.
      networkRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb({ rawOne: { maxDate: '2024-05-10' } }))
        .mockReturnValueOnce(
          makeQb({
            rawOne: {
              activeSources: '12',
              newContent: '340',
              avgSentiment: '0.25',
              alertCount: '3',
            },
          }),
        );

      const result = await service.getMacroDashboard({ networkId: 7 });

      expect(result).toEqual({
        scope: { networkId: 7 },
        date: '2024-05-10',
        activeSources: 12,
        newContent: 340,
        avgSentiment: 0.25,
        alertCount: 3,
      });
      // فقط جدول summary شبکه خوانده شده — هیچ منبع دیگری لمس نشده.
      expect(networkRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(sourceRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(keywordRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(clusterRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns empty dashboard when no summary data exists', async () => {
      networkRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb({ rawOne: { maxDate: null } }),
      );

      const result = await service.getMacroDashboard({});

      expect(result.date).toBeNull();
      expect(result.activeSources).toBe(0);
      expect(result.avgSentiment).toBeNull();
    });
  });

  describe('getSentimentTimeline (Requirement 8.3)', () => {
    it('returns timeline points from the network summary repository', async () => {
      networkRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb({
          rawMany: [
            { date: '2024-05-09', newContent: '100', avgSentiment: '0.1' },
            { date: '2024-05-10', newContent: '120', avgSentiment: null },
          ],
        }),
      );

      const points = await service.getSentimentTimeline(
        {},
        { from: '2024-05-01', to: '2024-05-31' },
      );

      expect(points).toEqual([
        { date: '2024-05-09', avgSentiment: 0.1, newContent: 100 },
        { date: '2024-05-10', avgSentiment: null, newContent: 120 },
      ]);
      expect(sourceRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects an inverted date range with a validation error', async () => {
      await expect(
        service.getSentimentTimeline({}, { from: '2024-05-31', to: '2024-05-01' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('getKeywordVelocity (Requirement 8.4)', () => {
    it('reads only from the keyword summary repository', async () => {
      keywordRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb({ rawOne: { maxDate: '2024-05-10' } }))
        .mockReturnValueOnce(
          makeQb({
            rawMany: [
              { keyword: 'تحریم', date: '2024-05-10', count: '50', velocity: '12' },
              { keyword: 'مذاکره', date: '2024-05-10', count: '30', velocity: null },
            ],
          }),
        );

      const result = await service.getKeywordVelocity({});

      expect(result).toEqual([
        { keyword: 'تحریم', date: '2024-05-10', count: 50, velocity: 12 },
        { keyword: 'مذاکره', date: '2024-05-10', count: 30, velocity: null },
      ]);
      expect(keywordRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(networkRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns empty list when there is no keyword data', async () => {
      keywordRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb({ rawOne: { maxDate: null } }),
      );
      const result = await service.getKeywordVelocity({ networkId: 4 });
      expect(result).toEqual([]);
    });
  });

  describe('getNetworkPulse (Requirement 8.5)', () => {
    it('returns latest metrics plus ascending timeline from the network repo', async () => {
      networkRepo.createQueryBuilder
        .mockReturnValueOnce(
          makeQb({
            entityOne: {
              date: '2024-05-10',
              active_sources: 8,
              new_content: 90,
              avg_sentiment: -0.2,
              alert_count: 1,
            },
          }),
        )
        .mockReturnValueOnce(
          makeQb({
            // به ترتیب نزولی واکشی می‌شوند؛ سرویس باید معکوس (صعودی) کند.
            entityMany: [
              { date: '2024-05-10', avg_sentiment: -0.2, new_content: 90 },
              { date: '2024-05-09', avg_sentiment: 0.0, new_content: 70 },
            ],
          }),
        );

      const pulse = await service.getNetworkPulse(7);

      expect(pulse.networkId).toBe(7);
      expect(pulse.date).toBe('2024-05-10');
      expect(pulse.activeSources).toBe(8);
      expect(pulse.timeline.map((t) => t.date)).toEqual([
        '2024-05-09',
        '2024-05-10',
      ]);
    });
  });

  describe('refreshSummaries (Requirement 8.6 — the only writer)', () => {
    it('writes only via DataSource transaction into summary tables', async () => {
      await service.refreshSummaries();

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      // چند دستور INSERT/DELETE روی جدول‌های summary اجرا شده است.
      expect(managerQuery).toHaveBeenCalled();
      const statements = managerQuery.mock.calls.map((c) => String(c[0]));
      expect(statements.some((s) => s.includes('source_daily_metrics'))).toBe(true);
      expect(statements.some((s) => s.includes('network_daily_metrics'))).toBe(true);
      expect(statements.some((s) => s.includes('cluster_daily_metrics'))).toBe(true);
      expect(statements.some((s) => s.includes('keyword_daily_metrics'))).toBe(true);
    });
  });

  describe('read-only / no fetch-or-LLM collaborators (Requirement 8.1 / 1.3)', () => {
    it('depends only on summary repositories and DataSource (no SourcesService)', () => {
      // بازتاب پارامترهای constructor: تنها repository های summary و DataSource.
      const paramTypes: unknown[] =
        Reflect.getMetadata('design:paramtypes', AnalyticsQueryService) ?? [];
      // پنج وابستگی: ۴ repository + DataSource. هیچ سرویس دامنه‌ای/AI/fetch نیست.
      expect(paramTypes).toHaveLength(5);
      expect(paramTypes).toContain(DataSource);

      const names = paramTypes.map((t) => (t as { name?: string })?.name ?? '');
      expect(names).not.toContain('SourcesService');
      expect(names).not.toContain('AiService');
      expect(names).not.toContain('CollectionService');
      expect(names).not.toContain('AnalysisService');
    });
  });
});
