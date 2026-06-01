import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertsService } from './strategic-alerts.service';
import { StrategicAlert } from '../../modules/strategic-alert/strategic-alert.entity';
import {
  InvalidStateTransitionException,
  NotFoundException,
} from '../../common/exceptions';

/**
 * تست واحد AlertsService (Requirement 9.1, 9.3, 9.4, 9.5).
 *
 * تمرکز: وضعیت اولیهٔ معتبر هنگام create، قرارداد صفحه‌بندی، پذیرش گذار مجاز و
 * رد گذار غیرمجاز با حفظ atomicity (عدم فراخوانی save هنگام رد).
 */
describe('AlertsService', () => {
  let service: AlertsService;
  let repo: jest.Mocked<Repository<StrategicAlert>>;

  const makeAlert = (over: Partial<StrategicAlert> = {}): StrategicAlert =>
    ({
      id: 1,
      title: 't',
      message: 'm',
      status: 'active',
      created_by: 1,
      ...over,
    }) as StrategicAlert;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: getRepositoryToken(StrategicAlert),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AlertsService);
    repo = module.get(getRepositoryToken(StrategicAlert));
  });

  describe('list', () => {
    it('returns a paginated envelope and clamps pageSize', async () => {
      repo.findAndCount.mockResolvedValue([[makeAlert()], 1]);

      const result = await service.list({ page: 1, pageSize: 9999 });

      expect(result.pageSize).toBe(100);
      expect(result.items.length).toBeLessThanOrEqual(result.pageSize);
      expect(result.total).toBeGreaterThanOrEqual(result.items.length);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 0 }),
      );
    });
  });

  describe('create', () => {
    it('persists with the valid initial status "active"', async () => {
      repo.create.mockImplementation((v) => v as StrategicAlert);
      repo.save.mockImplementation(async (v) => v as StrategicAlert);

      const result = await service.create({
        title: 't',
        message: 'm',
        created_by: 5,
        target_pages: [1, 2, 3],
      });

      expect(result.status).toBe('active');
      expect(result.involved_pages_count).toBe(3);
    });
  });

  describe('transition', () => {
    it('accepts a documented transition and persists the new status', async () => {
      const alert = makeAlert({ id: 9, status: 'active' });
      repo.findOne.mockResolvedValue(alert);
      repo.save.mockImplementation(async (v) => v as StrategicAlert);

      const result = await service.transition(9, { to: 'investigating' });

      expect(result.status).toBe('investigating');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('rejects an invalid transition without saving (atomicity)', async () => {
      const alert = makeAlert({ id: 9, status: 'active' });
      repo.findOne.mockResolvedValue(alert);

      await expect(
        service.transition(9, { to: 'needs_response' }),
      ).rejects.toBeInstanceOf(InvalidStateTransitionException);

      // وضعیت موجودیت دست‌نخورده مانده و هیچ persist رخ نداده است.
      expect(alert.status).toBe('active');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing alert', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.transition(404, { to: 'investigating' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
