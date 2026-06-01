import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourcesService } from './sources.service';
import { Page } from '../modules/page/page.entity';
import { ConflictException, NotFoundException } from '../common/exceptions';
import {
  SOURCES_ANALYSIS_DELEGATE,
  SOURCES_COLLECTION_DELEGATE,
} from './sources.delegation';

/**
 * تست واحد SourcesService با mock کردن Repository تایپ‌اورم.
 *
 * منطق واقعی سرویس آزمایش می‌شود — داده‌ای جعل نمی‌شود:
 *  - bulkCreate: dedupe بر اساس username+platform و شمارش created/skipped (Req 2.3)
 *  - assignCluster: تنظیم/حذف cluster_id (Req 2.4)
 *  - setRepresentative: تنظیم is_representative (Req 2.5)
 *  - setStatus + findActiveForAutoFetch: مدل وضعیت با is_active و کنارگذاری
 *    منابع غیرفعال از واکشی خودکار (Req 2.6)
 *  - findPaginated: قرارداد صفحه‌بندی (Req 2.1)
 */
describe('SourcesService', () => {
  let service: SourcesService;
  let repo: jest.Mocked<Repository<Page>>;
  let collectionDelegate: { collect: jest.Mock };
  let analysisDelegate: {
    analyzeSource: jest.Mock;
    generateSourceInsight: jest.Mock;
    getRunsForSource: jest.Mock;
  };

  const makeSource = (over: Partial<Page> = {}): Page =>
    ({
      id: 1,
      name: 'منبع نمونه',
      username: 'sample',
      platform: 'instagram',
      followers_count: 0,
      following_count: 0,
      cluster_id: null,
      is_representative: false,
      is_active: true,
      ...over,
    }) as Page;

  beforeEach(async () => {
    collectionDelegate = { collect: jest.fn() };
    analysisDelegate = {
      analyzeSource: jest.fn(),
      generateSourceInsight: jest.fn(),
      getRunsForSource: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        {
          provide: getRepositoryToken(Page),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        { provide: SOURCES_COLLECTION_DELEGATE, useValue: collectionDelegate },
        { provide: SOURCES_ANALYSIS_DELEGATE, useValue: analysisDelegate },
      ],
    }).compile();

    service = module.get(SourcesService);
    repo = module.get(getRepositoryToken(Page));
  });

  describe('findPaginated', () => {
    it('returns a paginated envelope shape with effective page/pageSize', async () => {
      const items = [makeSource({ id: 2 }), makeSource({ id: 1 })];
      repo.findAndCount.mockResolvedValue([items, 2]);

      const result = await service.findPaginated({ page: 1, pageSize: 20 });

      expect(result).toEqual({
        items,
        total: 2,
        page: 1,
        pageSize: 20,
      });
      expect(result.items.length).toBeLessThanOrEqual(result.pageSize);
      expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    });

    it('clamps pageSize above 100 down to 100', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPaginated({ page: 1, pageSize: 9999 });

      expect(result.pageSize).toBe(100);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 0 }),
      );
    });

    it('filters inactive sources by status', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findPaginated({ page: 1, pageSize: 20, status: 'inactive' });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns the source when found', async () => {
      const source = makeSource({ id: 7 });
      repo.findOne.mockResolvedValue(source);

      await expect(service.findById(7)).resolves.toBe(source);
    });

    it('throws NotFoundException when missing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new source when the username+platform key is unique', async () => {
      const dto = { name: 'x', username: 'new', platform: 'instagram' };
      const created = makeSource({ id: 3, ...dto });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await expect(service.create(dto)).resolves.toBe(created);
    });

    it('throws ConflictException when username+platform already exists', async () => {
      repo.findOne.mockResolvedValue(makeSource());

      await expect(
        service.create({ name: 'x', username: 'sample', platform: 'instagram' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreate', () => {
    it('dedupes against the database and reports created/skipped', async () => {
      // اولی موجود است (skip)، دومی جدید است (created).
      repo.findOne
        .mockResolvedValueOnce(makeSource({ username: 'a', platform: 'instagram' }))
        .mockResolvedValueOnce(null);
      repo.create.mockImplementation((v) => v as Page);
      repo.save.mockImplementation(async (v) => v as Page);

      const result = await service.bulkCreate({
        sources: [
          { name: 'A', username: 'a', platform: 'instagram' },
          { name: 'B', username: 'b', platform: 'instagram' },
        ],
      });

      expect(result).toEqual({ created: 1, skipped: 1 });
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('dedupes duplicates within the same batch', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((v) => v as Page);
      repo.save.mockImplementation(async (v) => v as Page);

      const result = await service.bulkCreate({
        sources: [
          { name: 'A', username: 'dup', platform: 'telegram' },
          { name: 'A2', username: 'dup', platform: 'telegram' },
        ],
      });

      expect(result).toEqual({ created: 1, skipped: 1 });
    });
  });

  describe('assignCluster', () => {
    it('assigns a cluster id', async () => {
      const source = makeSource({ id: 4, cluster_id: null });
      repo.findOne.mockResolvedValue(source);
      repo.save.mockImplementation(async (v) => v as Page);

      const result = await service.assignCluster(4, 10);
      expect(result.cluster_id).toBe(10);
    });

    it('clears the cluster id when null is passed', async () => {
      const source = makeSource({ id: 4, cluster_id: 10 });
      repo.findOne.mockResolvedValue(source);
      repo.save.mockImplementation(async (v) => v as Page);

      const result = await service.assignCluster(4, null);
      expect(result.cluster_id).toBeNull();
    });
  });

  describe('setRepresentative', () => {
    it('sets the representative flag', async () => {
      const source = makeSource({ id: 5, is_representative: false });
      repo.findOne.mockResolvedValue(source);
      repo.save.mockImplementation(async (v) => v as Page);

      const result = await service.setRepresentative(5, true);
      expect(result.is_representative).toBe(true);
    });
  });

  describe('setStatus / findActiveForAutoFetch', () => {
    it('deactivating a source sets is_active = false', async () => {
      const source = makeSource({ id: 6, is_active: true });
      repo.findOne.mockResolvedValue(source);
      repo.save.mockImplementation(async (v) => v as Page);

      const result = await service.setStatus(6, 'inactive');
      expect(result.is_active).toBe(false);
      expect(service.getStatus(result)).toBe('inactive');
    });

    it('excludes inactive sources from auto-fetch (only is_active=true)', async () => {
      const active = [makeSource({ id: 1, is_active: true })];
      repo.find.mockResolvedValue(active);

      await expect(service.findActiveForAutoFetch()).resolves.toBe(active);
      expect(repo.find).toHaveBeenCalledWith({ where: { is_active: true } });
    });
  });

  describe('remove', () => {
    it('removes an existing source', async () => {
      const source = makeSource({ id: 8 });
      repo.findOne.mockResolvedValue(source);
      repo.remove.mockResolvedValue(source);

      await expect(service.remove(8)).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(source);
    });

    it('throws NotFoundException when removing a missing source', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delegation: fetch / analyze / insight (Req 2.7)', () => {
    it('fetch validates the source then delegates to CollectionService', async () => {
      const source = makeSource({ id: 11 });
      repo.findOne.mockResolvedValue(source);
      const summary = {
        fetched: 5,
        created: 3,
        updated: 2,
        skipped: 0,
        errors: 0,
      };
      collectionDelegate.collect.mockResolvedValue(summary);

      await expect(service.fetch(11)).resolves.toBe(summary);
      expect(collectionDelegate.collect).toHaveBeenCalledWith(source);
    });

    it('fetch throws NotFoundException without delegating for a missing source', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.fetch(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(collectionDelegate.collect).not.toHaveBeenCalled();
    });

    it('analyze validates the source then delegates to AnalysisService with the timeframe', async () => {
      repo.findOne.mockResolvedValue(makeSource({ id: 12 }));
      const runSummary = {
        runId: 1,
        total: 4,
        succeeded: 4,
        failed: 0,
        status: 'succeeded',
      };
      analysisDelegate.analyzeSource.mockResolvedValue(runSummary);

      await expect(service.analyze(12, '7d')).resolves.toBe(runSummary);
      expect(analysisDelegate.analyzeSource).toHaveBeenCalledWith(12, '7d');
    });

    it('analyze throws NotFoundException without delegating for a missing source', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.analyze(404, 'all')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(analysisDelegate.analyzeSource).not.toHaveBeenCalled();
    });

    it('insight validates the source then delegates to AnalysisService', async () => {
      repo.findOne.mockResolvedValue(makeSource({ id: 13 }));
      const insightResult = { source_id: 13, narrative_description: 'x' };
      analysisDelegate.generateSourceInsight.mockResolvedValue(insightResult);

      await expect(service.insight(13)).resolves.toBe(insightResult);
      expect(analysisDelegate.generateSourceInsight).toHaveBeenCalledWith(13);
    });

    it('insight throws NotFoundException without delegating for a missing source', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.insight(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(analysisDelegate.generateSourceInsight).not.toHaveBeenCalled();
    });
  });

  describe('getAnalysisHistory (Req 2.8)', () => {
    it('validates the source then delegates to the analysis delegate with pagination', async () => {
      repo.findOne.mockResolvedValue(makeSource({ id: 14 }));
      const paged = {
        items: [
          {
            id: 9,
            type: 'content',
            scope_ref: 14,
            status: 'succeeded',
            total: 3,
            succeeded: 3,
            failed: 0,
          },
        ],
        total: 1,
        page: 2,
        pageSize: 50,
      };
      analysisDelegate.getRunsForSource.mockResolvedValue(paged);

      const result = await service.getAnalysisHistory(14, {
        page: 2,
        pageSize: 50,
      });

      expect(result).toBe(paged);
      expect(analysisDelegate.getRunsForSource).toHaveBeenCalledWith(14, {
        page: 2,
        pageSize: 50,
      });
    });

    it('throws NotFoundException without delegating for a missing source', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.getAnalysisHistory(404, { page: 1, pageSize: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(analysisDelegate.getRunsForSource).not.toHaveBeenCalled();
    });
  });
});
