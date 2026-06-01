import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NetworksService } from './networks.service';
import { Network } from './network.entity';
import {
  ConflictException,
  NotFoundException,
} from '../common/exceptions';

/**
 * تست واحد NetworksService با mock کردن Repository تایپ‌اورم.
 * منطق واقعی سرویس (بررسی یکتایی slug، fallback در getDefault، خطای not-found)
 * آزمایش می‌شود — داده‌ای جعل نمی‌شود.
 */
describe('NetworksService', () => {
  let service: NetworksService;
  let repo: jest.Mocked<Repository<Network>>;

  const makeNetwork = (over: Partial<Network> = {}): Network => ({
    id: 1,
    name: 'شبکه پیش‌فرض',
    slug: 'default',
    description: null,
    default_language: 'fa',
    target_narrative: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworksService,
        {
          provide: getRepositoryToken(Network),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NetworksService);
    repo = module.get(getRepositoryToken(Network));
  });

  describe('findAll', () => {
    it('returns all networks ordered by created_at', async () => {
      const networks = [makeNetwork()];
      repo.find.mockResolvedValue(networks);

      await expect(service.findAll()).resolves.toBe(networks);
      expect(repo.find).toHaveBeenCalledWith({ order: { created_at: 'ASC' } });
    });
  });

  describe('findById', () => {
    it('returns the network when found', async () => {
      const network = makeNetwork({ id: 7 });
      repo.findOne.mockResolvedValue(network);

      await expect(service.findById(7)).resolves.toBe(network);
    });

    it('throws NotFoundException when missing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getDefault', () => {
    it('returns the network with slug "default" when present', async () => {
      const def = makeNetwork({ slug: 'default' });
      repo.findOne.mockResolvedValueOnce(def);

      await expect(service.getDefault()).resolves.toBe(def);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: 'default' } });
    });

    it('falls back to the first active network when no default slug', async () => {
      const active = makeNetwork({ id: 5, slug: 'intl', is_active: true });
      repo.findOne
        .mockResolvedValueOnce(null) // no slug=default
        .mockResolvedValueOnce(active); // first active

      await expect(service.getDefault()).resolves.toBe(active);
    });

    it('throws NotFoundException when no networks exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getDefault()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new network when slug is unique', async () => {
      const dto = { name: 'بین‌الملل', slug: 'intl' };
      const created = makeNetwork({ id: 2, ...dto });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repo.create).toHaveBeenCalledWith(dto);
    });

    it('throws ConflictException when slug already exists', async () => {
      repo.findOne.mockResolvedValue(makeNetwork({ slug: 'intl' }));

      await expect(
        service.create({ name: 'x', slug: 'intl' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates an existing network', async () => {
      const existing = makeNetwork({ id: 3, slug: 'a' });
      repo.findOne.mockResolvedValueOnce(existing); // findById
      repo.save.mockImplementation(async (n) => n as Network);

      const result = await service.update(3, { name: 'نام جدید' });
      expect(result.name).toBe('نام جدید');
    });

    it('throws NotFoundException when updating a missing network', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(404, { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when changing slug to an existing one', async () => {
      const existing = makeNetwork({ id: 3, slug: 'a' });
      repo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(makeNetwork({ id: 9, slug: 'taken' })); // slug conflict

      await expect(
        service.update(3, { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
