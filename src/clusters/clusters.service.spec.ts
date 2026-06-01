import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClustersService } from './clusters.service';
import { Cluster } from '../modules/cluster/cluster.entity';
import { Page } from '../modules/page/page.entity';
import { ConflictException, NotFoundException } from '../common/exceptions';

/**
 * تست واحد ClustersService با mock کردن Repositoryهای تایپ‌اورم.
 *
 * منطق واقعی سرویس آزمایش می‌شود — داده‌ای جعل نمی‌شود:
 *  - create: یکتایی نام و پرتاب ConflictException در تکرار
 *  - findById/update/remove: رفتار NotFound و detach منابع هنگام حذف
 *  - assign/remove/setRepresentatives: توزیع منابع روی جدول pages مستقیماً
 *    (بدون وابستگی به SourcesService — مرز تمیز Requirement 1.2)
 *  - toggleRepresentative: اعتبارسنجی عضویت منبع در خوشه
 */
describe('ClustersService', () => {
  let service: ClustersService;
  let clusterRepo: jest.Mocked<Repository<Cluster>>;
  let pageRepo: jest.Mocked<Repository<Page>>;

  const makeCluster = (over: Partial<Cluster> = {}): Cluster =>
    ({
      id: 1,
      name: 'خوشهٔ نمونه',
      description: null,
      color: '#1976d2',
      icon: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...over,
    }) as Cluster;

  const makePage = (over: Partial<Page> = {}): Page =>
    ({
      id: 1,
      name: 'منبع نمونه',
      cluster_id: 1,
      is_representative: false,
      influence_score: 0,
      ...over,
    }) as Page;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClustersService,
        {
          provide: getRepositoryToken(Cluster),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Page),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ClustersService);
    clusterRepo = module.get(getRepositoryToken(Cluster));
    pageRepo = module.get(getRepositoryToken(Page));
  });

  describe('findAll', () => {
    it('attaches pages_count and representatives_count per cluster', async () => {
      clusterRepo.find.mockResolvedValue([makeCluster({ id: 1 })]);
      pageRepo.count
        .mockResolvedValueOnce(5) // pages_count
        .mockResolvedValueOnce(2); // representatives_count

      const result = await service.findAll();

      expect(result).toEqual([
        expect.objectContaining({
          id: 1,
          pages_count: 5,
          representatives_count: 2,
        }),
      ]);
    });
  });

  describe('findById', () => {
    it('returns the cluster with member sources and stats', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 3 }));
      pageRepo.find.mockResolvedValue([
        makePage({ id: 1, is_representative: true }),
        makePage({ id: 2, is_representative: false }),
      ]);

      const result = await service.findById(3);

      expect(result.id).toBe(3);
      expect(result.pages_count).toBe(2);
      expect(result.representatives_count).toBe(1);
    });

    it('throws NotFoundException when missing', async () => {
      clusterRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a cluster when the name is unique', async () => {
      const dto = { name: 'جدید' };
      const created = makeCluster({ id: 7, name: 'جدید' });
      clusterRepo.findOne.mockResolvedValue(null);
      clusterRepo.create.mockReturnValue(created);
      clusterRepo.save.mockResolvedValue(created);

      await expect(service.create(dto)).resolves.toBe(created);
    });

    it('throws ConflictException when the name already exists', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster());
      await expect(
        service.create({ name: 'خوشهٔ نمونه' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(clusterRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('detaches member sources before removing the cluster', async () => {
      const cluster = makeCluster({ id: 4 });
      clusterRepo.findOne.mockResolvedValue(cluster);
      pageRepo.update.mockResolvedValue({ affected: 3 } as never);
      clusterRepo.remove.mockResolvedValue(cluster);

      await expect(service.remove(4)).resolves.toBeUndefined();
      expect(pageRepo.update).toHaveBeenCalledWith(
        { cluster_id: 4 },
        { cluster_id: null, is_representative: false },
      );
      expect(clusterRepo.remove).toHaveBeenCalledWith(cluster);
    });

    it('throws NotFoundException when removing a missing cluster', async () => {
      clusterRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assignSources / removeSources', () => {
    it('assigns sources to the cluster and reports updated count', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 5 }));
      pageRepo.update.mockResolvedValue({ affected: 2 } as never);

      const result = await service.assignSources(5, { source_ids: [10, 11] });
      expect(result).toEqual({ updated: 2 });
    });

    it('returns updated: 0 for an empty source list without touching pages', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 5 }));

      const result = await service.assignSources(5, { source_ids: [] });
      expect(result).toEqual({ updated: 0 });
      expect(pageRepo.update).not.toHaveBeenCalled();
    });

    it('removeSources clears cluster_id and representative flag', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 5 }));
      pageRepo.update.mockResolvedValue({ affected: 1 } as never);

      const result = await service.removeSources(5, { source_ids: [10] });
      expect(result).toEqual({ updated: 1 });
    });
  });

  describe('setRepresentatives', () => {
    it('clears all reps then sets the chosen member sources', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 6 }));
      pageRepo.update.mockResolvedValue({ affected: 1 } as never);
      pageRepo.find.mockResolvedValue([makePage({ id: 1 })]);

      await service.setRepresentatives(6, { source_ids: [1] });

      // اول همهٔ نمایندگان خوشه پاک می‌شوند، سپس انتخاب‌شده‌ها تنظیم می‌شوند.
      expect(pageRepo.update).toHaveBeenNthCalledWith(
        1,
        { cluster_id: 6 },
        { is_representative: false },
      );
      expect(pageRepo.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ cluster_id: 6 }),
        { is_representative: true },
      );
    });
  });

  describe('toggleRepresentative', () => {
    it('sets the flag when the source belongs to the cluster', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 2 }));
      const page = makePage({ id: 9, cluster_id: 2, is_representative: false });
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.save.mockImplementation(async (v) => v as Page);

      const result = await service.toggleRepresentative(2, 9, {
        is_representative: true,
      });
      expect(result.is_representative).toBe(true);
    });

    it('throws ConflictException when the source is not in the cluster', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 2 }));
      pageRepo.findOne.mockResolvedValue(makePage({ id: 9, cluster_id: 99 }));

      await expect(
        service.toggleRepresentative(2, 9, { is_representative: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the source does not exist', async () => {
      clusterRepo.findOne.mockResolvedValue(makeCluster({ id: 2 }));
      pageRepo.findOne.mockResolvedValue(null);

      await expect(
        service.toggleRepresentative(2, 404, { is_representative: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
