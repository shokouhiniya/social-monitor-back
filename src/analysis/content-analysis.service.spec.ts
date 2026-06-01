import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AiExecutionResult } from '../ai/ai.types';
import { AiService } from '../ai/ai.service';
import { ContentService } from '../content/content.service';
import { Post } from '../modules/post/post.entity';
import { PromptsService } from '../prompts/prompts.service';
import { AnalysisRunService } from './analysis-run.service';
import { ContentAnalysisService } from './content-analysis.service';
import { AnalysisRunEntity } from './entities/analysis-run.entity';
import { ContentAnalysisResultEntity } from './entities/content-analysis-result.entity';

/**
 * تست واحد ContentAnalysisService با mock کردن وابستگی‌ها (PromptsService،
 * AiService، ContentService، repositoryها و DataSource) — بدون mock کردن منطق
 * واقعی سرویس.
 *
 * تمرکز:
 *  - شمارش صحیح succeeded/failed در `analyzeSource` (Requirement 7.2/7.6).
 *  - رفتار `validation_error`: شمارش به‌عنوان failed و عدم ذخیرهٔ نتیجهٔ نامعتبر
 *    (Requirement 7.5).
 *  - ساخت رکورد `analysis_runs` در آغاز و به‌روزرسانی وضعیت نهایی در پایان
 *    (Requirement 7.6).
 *  - دوگانه‌نویسی اتمیک: نوشتن هم‌زمان در `content_analysis_results` و ستون‌های
 *    قدیمی `posts` داخل **یک تراکنش**؛ هیچ مسیر نوشتنِ تک‌محلی وجود ندارد و شکست
 *    یکی موجب rollback هر دو می‌شود (Requirement 13.5/13.6 — تسک ۵.۹).
 */
describe('ContentAnalysisService', () => {
  let service: ContentAnalysisService;
  let resultRepo: jest.Mocked<Repository<ContentAnalysisResultEntity>>;
  let runRepo: jest.Mocked<Repository<AnalysisRunEntity>>;
  let contentService: { findById: jest.Mock; getUnanalyzed: jest.Mock };
  let promptsService: { resolveActiveVersion: jest.Mock };
  let aiService: { execute: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  /** save روی EntityManager تراکنشی — درج content_analysis_results. */
  let managerSave: jest.Mock;
  /** update روی EntityManager تراکنشی — به‌روزرسانی ستون‌های قدیمی posts. */
  let managerUpdate: jest.Mock;

  /** snapshot نسخهٔ فعال prompt برای تست (خروجی resolveActiveVersion). */
  const snapshot = {
    template: 'تحلیل کن: {{caption}}',
    model: 'google/gemini-2.5-pro',
    response_format: 'json' as const,
    output_schema: null,
    versionId: 7,
  };

  /** خروجی موفق AI با شکل معتبر ContentAnalysisOutput. */
  const successResult: AiExecutionResult = {
    status: 'success',
    raw: '{"sentiment":{"score":0.5,"label":"positive","reason":"x"},"keywords":["a"]}',
    parsed: {
      sentiment: { score: 0.5, label: 'positive', reason: 'خوب' },
      keywords: ['کلید'],
      topics: ['موضوع'],
      summary_fa: 'خلاصه',
      is_relevant: true,
      coverage_type: 'analysis',
      narrative_position: 'موافق',
      risk_level: 'low',
      recommended_attention: 'normal',
    },
    durationMs: 12,
  };

  /** خروجی validation_error از AI (Requirement 7.5). */
  const validationErrorResult: AiExecutionResult = {
    status: 'validation_error',
    raw: 'not-json',
    parsed: null,
    validationErrors: ['$.sentiment: فیلد الزامی موجود نیست'],
    durationMs: 8,
    errorMessage: 'خروجی مدل با schema خروجی هم‌خوان نبود',
  };

  const makeContent = (id: number) =>
    ({ id, caption: `پست ${id}`, caption_fa: '', page_id: 1 }) as never;

  beforeEach(async () => {
    contentService = { findById: jest.fn(), getUnanalyzed: jest.fn() };
    promptsService = { resolveActiveVersion: jest.fn() };
    aiService = { execute: jest.fn() };

    // EntityManager تراکنشی mock: save رکورد نتیجه را با id برمی‌گرداند و update
    // به‌روزرسانی posts را ثبت می‌کند. هر دو در یک callback تراکنش اجرا می‌شوند.
    managerSave = jest.fn(async (_entity: unknown, value: unknown) => ({
      id: 1,
      ...(value as object),
    }));
    managerUpdate = jest.fn(async () => ({ affected: 1 }));
    dataSource = {
      transaction: jest.fn(
        async (cb: (manager: EntityManager) => Promise<unknown>) =>
          cb({ save: managerSave, update: managerUpdate } as never),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentAnalysisService,
        AnalysisRunService,
        {
          provide: getRepositoryToken(ContentAnalysisResultEntity),
          useValue: {
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => ({ id: 1, ...v })),
          },
        },
        {
          provide: getRepositoryToken(AnalysisRunEntity),
          useValue: {
            create: jest.fn((v) => v),
            // save در start (ساخت) و finish (نهایی‌سازی) صدا زده می‌شود.
            save: jest.fn(async (v) => ({ id: v.id ?? 42, ...v })),
            update: jest.fn(async () => ({ affected: 1 })),
          },
        },
        { provide: ContentService, useValue: contentService },
        { provide: PromptsService, useValue: promptsService },
        { provide: AiService, useValue: aiService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ContentAnalysisService);
    resultRepo = module.get(getRepositoryToken(ContentAnalysisResultEntity));
    runRepo = module.get(getRepositoryToken(AnalysisRunEntity));

    promptsService.resolveActiveVersion.mockResolvedValue(snapshot);
  });

  describe('analyzeContent', () => {
    it('persists a content_analysis_results row on success (Req 7.1)', async () => {
      contentService.findById.mockResolvedValue(makeContent(10));
      aiService.execute.mockResolvedValue(successResult);

      const saved = await service.analyzeContent(10);

      expect(managerSave).toHaveBeenCalledTimes(1);
      expect(saved).toEqual(
        expect.objectContaining({
          content_id: 10,
          sentiment_score: 0.5,
          sentiment_label: 'positive',
          keywords: ['کلید'],
          prompt_version_id: 7,
        }),
      );
    });

    it('throws and does NOT persist on validation_error (Req 7.5)', async () => {
      contentService.findById.mockResolvedValue(makeContent(11));
      aiService.execute.mockResolvedValue(validationErrorResult);

      await expect(service.analyzeContent(11)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      // هیچ تراکنش نوشتنی باز نشده — نه نتیجه و نه posts.
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(managerSave).not.toHaveBeenCalled();
      expect(managerUpdate).not.toHaveBeenCalled();
    });

    it('maps provider_error to AI_PROVIDER_ERROR and does not persist', async () => {
      contentService.findById.mockResolvedValue(makeContent(12));
      aiService.execute.mockResolvedValue({
        status: 'provider_error',
        raw: '',
        parsed: null,
        durationMs: 5,
        errorMessage: 'provider down',
      } as AiExecutionResult);

      await expect(service.analyzeContent(12)).rejects.toMatchObject({
        code: 'AI_PROVIDER_ERROR',
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(managerSave).not.toHaveBeenCalled();
      expect(managerUpdate).not.toHaveBeenCalled();
    });
  });

  describe('atomic dual-write (Req 13.5/13.6 — تسک ۵.۹)', () => {
    it('writes BOTH content_analysis_results and legacy posts columns inside one transaction', async () => {
      contentService.findById.mockResolvedValue(makeContent(20));
      aiService.execute.mockResolvedValue(successResult);

      await service.analyzeContent(20);

      // یک تراکنش واحد برای هر دو نوشتن استفاده شده است.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // (۱) درج رکورد جدید content_analysis_results با مقادیر structured.
      expect(managerSave).toHaveBeenCalledTimes(1);
      expect(managerSave).toHaveBeenCalledWith(
        ContentAnalysisResultEntity,
        expect.objectContaining({
          content_id: 20,
          sentiment_score: 0.5,
          keywords: ['کلید'],
          topics: ['موضوع'],
        }),
      );

      // (۲) به‌روزرسانی ستون‌های قدیمی همان posts با مقادیر معادل.
      expect(managerUpdate).toHaveBeenCalledTimes(1);
      expect(managerUpdate).toHaveBeenCalledWith(
        Post,
        { id: 20 },
        expect.objectContaining({
          sentiment_score: 0.5,
          sentiment_label: 'positive',
          extracted_keywords: ['کلید'],
          extracted_topics: ['موضوع'],
        }),
      );
    });

    it('writes equivalent sentiment_score and keywords to both locations', async () => {
      contentService.findById.mockResolvedValue(makeContent(21));
      aiService.execute.mockResolvedValue(successResult);

      await service.analyzeContent(21);

      const resultRow = managerSave.mock.calls[0][1] as ContentAnalysisResultEntity;
      const postUpdate = managerUpdate.mock.calls[0][2] as Partial<Post>;

      // sentiment_score در هر دو محل برابر است (Property 6).
      expect(postUpdate.sentiment_score).toBe(resultRow.sentiment_score);
      // مجموعهٔ keywords در هر دو محل معادل است (به‌عنوان مجموعه).
      expect(new Set(postUpdate.extracted_keywords)).toEqual(
        new Set(resultRow.keywords ?? []),
      );
    });

    it('rolls back (rejects) without committing when the legacy posts update fails', async () => {
      contentService.findById.mockResolvedValue(makeContent(22));
      aiService.execute.mockResolvedValue(successResult);
      // شکست در نوشتن محل قدیمی باید کل تراکنش را شکست دهد (هیچ‌کدام commit نشود).
      managerUpdate.mockRejectedValueOnce(new Error('posts update failed'));

      await expect(service.analyzeContent(22)).rejects.toThrow(
        'posts update failed',
      );
      // هر دو نوشتن داخل همان callback تراکنش بوده‌اند؛ خطا منتشر و تراکنش
      // rollback می‌شود — یعنی نتیجه جداگانه commit نمی‌ماند.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyzeSource run counting (Req 7.2/7.6)', () => {
    it('counts all succeeded when every item analyzes successfully', async () => {
      contentService.getUnanalyzed.mockResolvedValue([
        makeContent(1),
        makeContent(2),
        makeContent(3),
      ]);
      contentService.findById.mockImplementation(async (id: number) =>
        makeContent(id),
      );
      aiService.execute.mockResolvedValue(successResult);

      const summary = await service.analyzeSource(1, '7d');

      expect(summary).toEqual(
        expect.objectContaining({
          total: 3,
          succeeded: 3,
          failed: 0,
          status: 'succeeded',
        }),
      );
      expect(managerSave).toHaveBeenCalledTimes(3);
      expect(managerUpdate).toHaveBeenCalledTimes(3);
    });

    it('counts validation_error items as failed and yields partial status', async () => {
      contentService.getUnanalyzed.mockResolvedValue([
        makeContent(1),
        makeContent(2),
        makeContent(3),
      ]);
      contentService.findById.mockImplementation(async (id: number) =>
        makeContent(id),
      );
      // آیتم اول و سوم موفق، آیتم دوم validation_error.
      aiService.execute
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(validationErrorResult)
        .mockResolvedValueOnce(successResult);

      const summary = await service.analyzeSource(1, '7d');

      expect(summary).toEqual(
        expect.objectContaining({
          total: 3,
          succeeded: 2,
          failed: 1,
          status: 'partial',
        }),
      );
      // تنها دو آیتم موفق ذخیره شده‌اند (خروجی نامعتبر ذخیره نشده — Req 7.5).
      expect(managerSave).toHaveBeenCalledTimes(2);
    });

    it('yields failed status when all items fail', async () => {
      contentService.getUnanalyzed.mockResolvedValue([makeContent(1)]);
      contentService.findById.mockResolvedValue(makeContent(1));
      aiService.execute.mockResolvedValue(validationErrorResult);

      const summary = await service.analyzeSource(1, '24h');

      expect(summary).toEqual(
        expect.objectContaining({
          total: 1,
          succeeded: 0,
          failed: 1,
          status: 'failed',
        }),
      );
    });

    it('creates a running analysis_run at start and finalizes it (Req 7.6)', async () => {
      contentService.getUnanalyzed.mockResolvedValue([makeContent(1)]);
      contentService.findById.mockResolvedValue(makeContent(1));
      aiService.execute.mockResolvedValue(successResult);

      await service.analyzeSource(5, '30d');

      // اولین save رکورد running است؛ آخرین save وضعیت نهایی را دارد.
      const firstSavedRun = runRepo.save.mock.calls[0][0];
      expect(firstSavedRun).toEqual(
        expect.objectContaining({
          type: 'content',
          scope_ref: '5',
          timeframe: '30d',
          status: 'running',
          total: 1,
        }),
      );
      const lastSavedRun =
        runRepo.save.mock.calls[runRepo.save.mock.calls.length - 1][0];
      expect(lastSavedRun).toEqual(
        expect.objectContaining({ status: 'succeeded', finished_at: expect.any(Date) }),
      );
    });

    it('handles empty unanalyzed set as a succeeded no-op run', async () => {
      contentService.getUnanalyzed.mockResolvedValue([]);

      const summary = await service.analyzeSource(9, 'all');

      expect(summary).toEqual(
        expect.objectContaining({
          total: 0,
          succeeded: 0,
          failed: 0,
          status: 'succeeded',
        }),
      );
      expect(aiService.execute).not.toHaveBeenCalled();
      expect(managerSave).not.toHaveBeenCalled();
    });
  });
});
