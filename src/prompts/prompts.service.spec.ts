import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiExecutionLog } from '../ai/ai-execution-log.entity';
import { AiService } from '../ai/ai.service';
import { NotFoundException } from '../common/exceptions';
import { PromptsService } from './prompts.service';
import { PromptDefinition } from './prompt-definition.entity';
import { PromptVersion } from './prompt-version.entity';

/**
 * تست واحد PromptsService با mock کردن Repositoryها، AiService و DataSource.
 *
 * منطق واقعی سرویس آزمایش می‌شود — داده‌ای جعل نمی‌شود:
 *  - createVersion: شمارهٔ نسخهٔ افزایشی (Requirement 6.2) و غیرفعال بودن پیش‌فرض
 *  - activateVersion: تضمین «دقیقاً یک نسخهٔ فعال» درون transaction (Requirement 6.3)
 *  - resolveActiveVersion / getByKey / test / getExecutions / setActive: رفتار پایه
 */
describe('PromptsService', () => {
  let service: PromptsService;
  let definitionRepo: jest.Mocked<Repository<PromptDefinition>>;
  let versionRepo: jest.Mocked<Repository<PromptVersion>>;
  let logRepo: jest.Mocked<Repository<AiExecutionLog>>;
  let aiService: { execute: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const makeDefinition = (
    over: Partial<PromptDefinition> = {},
  ): PromptDefinition =>
    ({
      id: 1,
      key: 'content_analysis',
      title: 'تحلیل محتوا',
      description: null,
      category: 'analysis',
      default_model: 'google/gemini-2.5-pro',
      output_schema: null,
      is_active: true,
      versions: [],
      created_at: new Date(),
      updated_at: new Date(),
      ...over,
    }) as PromptDefinition;

  const makeVersion = (over: Partial<PromptVersion> = {}): PromptVersion =>
    ({
      id: 1,
      prompt_definition_id: 1,
      version: 1,
      template: 'تمپلیت {{input}}',
      extra_instructions: null,
      model: 'google/gemini-2.5-pro',
      temperature: 0.3,
      response_format: 'json',
      created_by: null,
      created_at: new Date(),
      is_active: false,
      ...over,
    }) as PromptVersion;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        {
          provide: getRepositoryToken(PromptDefinition),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PromptVersion),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AiExecutionLog),
          useValue: {
            findAndCount: jest.fn(),
          },
        },
        {
          provide: AiService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PromptsService);
    definitionRepo = module.get(getRepositoryToken(PromptDefinition));
    versionRepo = module.get(getRepositoryToken(PromptVersion));
    logRepo = module.get(getRepositoryToken(AiExecutionLog));
    aiService = module.get(AiService);
    dataSource = module.get(DataSource);
  });

  describe('createVersion', () => {
    it('assigns an incrementing version number (max + 1)', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      // بیشینهٔ نسخهٔ موجود = ۳
      versionRepo.findOne.mockResolvedValue(makeVersion({ version: 3 }));
      versionRepo.create.mockImplementation((v) => v as PromptVersion);
      versionRepo.save.mockImplementation(async (v) => v as PromptVersion);

      const result = await service.createVersion('content_analysis', {
        template: 'تمپلیت جدید',
      });

      expect(result.version).toBe(4);
      expect(result.is_active).toBe(false);
    });

    it('starts at version 1 when no versions exist', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      versionRepo.findOne.mockResolvedValue(null);
      versionRepo.create.mockImplementation((v) => v as PromptVersion);
      versionRepo.save.mockImplementation(async (v) => v as PromptVersion);

      const result = await service.createVersion('content_analysis', {
        template: 'اولین نسخه',
      });

      expect(result.version).toBe(1);
    });

    it('throws NotFoundException for an unknown prompt key', async () => {
      definitionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createVersion('does_not_exist', { template: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('activateVersion', () => {
    it('deactivates all versions then activates only the target (single active)', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      versionRepo.findOne.mockResolvedValue(
        makeVersion({ id: 42, prompt_definition_id: 1, is_active: false }),
      );

      const update = jest.fn().mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (cb) =>
        cb({ update }),
      );

      const result = await service.activateVersion('content_analysis', 42);

      // اول همهٔ نسخه‌های این prompt غیرفعال می‌شوند.
      expect(update).toHaveBeenNthCalledWith(
        1,
        PromptVersion,
        { prompt_definition_id: 1 },
        { is_active: false },
      );
      // سپس تنها نسخهٔ هدف فعال می‌شود.
      expect(update).toHaveBeenNthCalledWith(
        2,
        PromptVersion,
        { id: 42 },
        { is_active: true },
      );
      expect(result.is_active).toBe(true);
    });

    it('throws NotFoundException when the version does not belong to the prompt', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      versionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.activateVersion('content_analysis', 999),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('resolveActiveVersion', () => {
    it('maps the active version + definition schema to a snapshot', async () => {
      definitionRepo.findOne.mockResolvedValue(
        makeDefinition({
          id: 1,
          output_schema: { type: 'object', required: ['x'] },
        }),
      );
      versionRepo.findOne.mockResolvedValue(
        makeVersion({
          id: 7,
          template: 'تمپلیت فعال',
          model: 'model-x',
          temperature: 0.5,
          response_format: 'json',
          is_active: true,
        }),
      );

      const snapshot = await service.resolveActiveVersion('content_analysis');

      expect(snapshot).toEqual({
        template: 'تمپلیت فعال',
        model: 'model-x',
        temperature: 0.5,
        response_format: 'json',
        extra_instructions: undefined,
        output_schema: { type: 'object', required: ['x'] },
        versionId: 7,
      });
    });

    it('throws NotFoundException when no active version exists', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      versionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolveActiveVersion('content_analysis'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('test', () => {
    it('executes the active version via AiService when no versionId is given', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      versionRepo.findOne.mockResolvedValue(
        makeVersion({ id: 5, is_active: true }),
      );
      aiService.execute.mockResolvedValue({
        status: 'success',
        raw: '{}',
        parsed: {},
        durationMs: 1,
      });

      const result = await service.test('content_analysis', { a: 1 });

      expect(aiService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          promptKey: 'content_analysis',
          input: { a: 1 },
          version: expect.objectContaining({ versionId: 5 }),
        }),
      );
      expect(result.status).toBe('success');
    });
  });

  describe('getExecutions', () => {
    it('returns a paginated list of execution logs for the prompt', async () => {
      definitionRepo.findOne.mockResolvedValue(makeDefinition({ id: 1 }));
      logRepo.findAndCount.mockResolvedValue([
        [{ id: 1 } as AiExecutionLog],
        1,
      ]);

      const result = await service.getExecutions('content_analysis', {
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(logRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { prompt_key: 'content_analysis' },
        }),
      );
    });
  });

  describe('setActive', () => {
    it('updates is_active on the definition', async () => {
      const def = makeDefinition({ id: 1, is_active: true });
      definitionRepo.findOne.mockResolvedValue(def);
      definitionRepo.save.mockImplementation(async (d) => d as PromptDefinition);

      const result = await service.setActive('content_analysis', false);
      expect(result.is_active).toBe(false);
    });
  });
});
