import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlansService } from './action-plans.service';
import { ActionPlan } from '../../modules/action-plan/action-plan.entity';
import {
  InvalidStateTransitionException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';

/**
 * تست واحد ActionPlansService (Requirement 9.2, 9.3, 9.4, 9.5).
 */
describe('ActionPlansService', () => {
  let service: ActionPlansService;
  let repo: jest.Mocked<Repository<ActionPlan>>;

  const makePlan = (over: Partial<ActionPlan> = {}): ActionPlan =>
    ({
      id: 1,
      title: 't',
      status: 'todo',
      page_id: 1,
      priority: 0,
      ...over,
    }) as ActionPlan;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionPlansService,
        {
          provide: getRepositoryToken(ActionPlan),
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

    service = module.get(ActionPlansService);
    repo = module.get(getRepositoryToken(ActionPlan));
  });

  describe('list', () => {
    it('returns a paginated envelope honoring the contract', async () => {
      repo.findAndCount.mockResolvedValue([[makePlan()], 1]);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(result.items.length).toBeLessThanOrEqual(result.pageSize);
    });
  });

  describe('create', () => {
    it('persists with valid initial status "todo"', async () => {
      repo.create.mockImplementation((v) => v as ActionPlan);
      repo.save.mockImplementation(async (v) => v as ActionPlan);

      const result = await service.create({ title: 't', page_id: 1 });
      expect(result.status).toBe('todo');
    });

    it('requires page_id or cluster_id', async () => {
      await expect(service.create({ title: 't' })).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('transition', () => {
    it('accepts todo -> in_progress', async () => {
      const plan = makePlan({ id: 3, status: 'todo' });
      repo.findOne.mockResolvedValue(plan);
      repo.save.mockImplementation(async (v) => v as ActionPlan);

      const result = await service.transition(3, { to: 'in_progress' });
      expect(result.status).toBe('in_progress');
    });

    it('rejects done -> cancelled without saving (atomicity)', async () => {
      const plan = makePlan({ id: 3, status: 'done' });
      repo.findOne.mockResolvedValue(plan);

      await expect(
        service.transition(3, { to: 'cancelled' }),
      ).rejects.toBeInstanceOf(InvalidStateTransitionException);

      expect(plan.status).toBe('done');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing plan', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.transition(404, { to: 'in_progress' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
