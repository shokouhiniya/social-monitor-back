import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiExecutionResult } from '../ai/ai.types';
import { AiService } from '../ai/ai.service';
import { DomainException, ERROR_CODES } from '../common/exceptions';
import { ContentService } from '../content/content.service';
import { ContentItem, Timeframe } from '../content/content.types';
import { Post } from '../modules/post/post.entity';
import { PromptsService } from '../prompts/prompts.service';
import { AnalysisRunService } from './analysis-run.service';
import {
  AnalysisRunSummary,
  CONTENT_ANALYSIS_PROMPT_KEY,
} from './analysis.types';
import { ContentAnalysisResultEntity } from './entities/content-analysis-result.entity';
import {
  CONTENT_ANALYSIS_OUTPUT_SCHEMA,
  ContentAnalysisOutput,
  extractContentAnalysis,
} from './schemas/content-analysis.schema';

/**
 * سرویس تحلیل محتوا (design §5.8، Requirement 7.1/7.2/7.5/7.6).
 *
 * **مسئولیت‌ها:**
 *  - `analyzeContent(contentId)`: resolve نسخهٔ فعال prompt `content_analysis`،
 *    اجرا از طریق `AiService` و ذخیرهٔ یک `content_analysis_results`
 *    (Requirement 7.1). در صورت `validation_error`، خروجی نامعتبر به‌عنوان نتیجهٔ
 *    معتبر ذخیره نمی‌شود (Requirement 7.5).
 *  - `analyzeSource(sourceId, timeframe)`: تحلیل محتوای تحلیل‌نشدهٔ بازه و
 *    ساخت/به‌روزرسانی یک رکورد `analysis_runs` با شمارش‌ها (Requirement 7.2/7.6).
 *
 * **مرز AI (design §3.2):** هیچ فراخوانی مستقیم provider در این لایه نیست؛ همه
 * از طریق `AiService` انجام می‌شود و خروجی structured آن مصرف می‌شود.
 *
 * **مرز دوگانه‌نویسی (Requirement 13.5/13.6 — تسک ۵.۹):** در دورهٔ گذار،
 * `analyzeContent` مقدار `sentiment_score` و مجموعهٔ `keywords` را در **یک
 * تراکنش** هم در رکورد جدید `content_analysis_results` و هم در ستون‌های قدیمی
 * `posts` (`sentiment_score`/`sentiment_label`/`extracted_keywords`/
 * `extracted_topics`) می‌نویسد. هیچ مسیر نوشتنی وجود ندارد که تنها یکی از دو محل
 * را به‌روزرسانی کند؛ هر دو نوشتن با هم commit یا با هم rollback می‌شوند.
 */
@Injectable()
export class ContentAnalysisService {
  private readonly logger = new Logger(ContentAnalysisService.name);

  constructor(
    @InjectRepository(ContentAnalysisResultEntity)
    private readonly resultRepository: Repository<ContentAnalysisResultEntity>,
    private readonly contentService: ContentService,
    private readonly promptsService: PromptsService,
    private readonly aiService: AiService,
    private readonly runService: AnalysisRunService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * تحلیل یک ContentItem و ذخیرهٔ `ContentAnalysisResult` (Requirement 7.1).
   *
   * جریان: یافتن محتوا → resolve نسخهٔ فعال prompt → اجرا از طریق `AiService` →
   * در صورت موفقیت، ذخیرهٔ نتیجهٔ structured؛ در صورت خطا، پرتاب `DomainException`
   * با کد نمادین مناسب (validation/provider/timeout — Requirement 7.5).
   *
   * `analysisRunId` اختیاری است تا هنگام فراخوانی از مسیر batch
   * (`analyzeSource`) نتیجه به آن اجرا گره بخورد.
   */
  async analyzeContent(
    contentId: number,
    analysisRunId?: number,
  ): Promise<ContentAnalysisResultEntity> {
    const content = await this.contentService.findById(contentId);
    const snapshot = await this.promptsService.resolveActiveVersion(
      CONTENT_ANALYSIS_PROMPT_KEY,
    );

    const execution = await this.aiService.execute({
      promptKey: CONTENT_ANALYSIS_PROMPT_KEY,
      version: {
        ...snapshot,
        // در نبود schema تعریف‌شده روی prompt، توصیف‌گر تحلیل محتوا fallback می‌شود
        // تا اعتبارسنجی هستهٔ خروجی برقرار بماند (Requirement 7.5).
        output_schema:
          snapshot.output_schema ?? CONTENT_ANALYSIS_OUTPUT_SCHEMA,
      },
      input: this.buildInput(content),
      entityRef: { type: 'content', id: contentId },
    });

    // رد خروجی نامعتبر schema — به‌عنوان نتیجهٔ معتبر ذخیره نمی‌شود (Requirement 7.5).
    if (execution.status !== 'success') {
      throw this.toDomainException(execution, contentId);
    }

    const output = extractContentAnalysis(execution.parsed);
    if (!output) {
      // parse موفق ولی شکل غیرمنتظره — مانند validation_error رفتار می‌شود.
      throw new DomainException(
        ERROR_CODES.VALIDATION_ERROR,
        `خروجی تحلیل محتوای ${contentId} با schema هم‌خوان نبود`,
      );
    }

    return this.persistResult(contentId, output, snapshot, execution, analysisRunId);
  }

  /**
   * تحلیل دسته‌ای محتوای تحلیل‌نشدهٔ یک منبع در یک بازهٔ زمانی و ساخت/به‌روزرسانی
   * یک رکورد `analysis_runs` (Requirement 7.2/7.6).
   *
   * یک اجرای تحلیل با وضعیت `running` ساخته می‌شود؛ سپس هر آیتم به‌صورت ایزوله
   * تحلیل می‌شود (شکست یک آیتم اجرای کل را متوقف نمی‌کند). در پایان، شمارش‌ها و
   * وضعیت نهایی ثبت و یک `AnalysisRunSummary` برگردانده می‌شود.
   *
   * **رفتار شکست (Requirement 7.5):** هر آیتمی که `analyzeContent` برای آن خطا
   * بدهد (validation/provider/timeout) به‌عنوان `failed` شمارش می‌شود و نتیجهٔ
   * نامعتبر ذخیره نمی‌شود.
   */
  async analyzeSource(
    sourceId: number,
    timeframe: Timeframe,
    triggeredBy?: number,
  ): Promise<AnalysisRunSummary> {
    const items = await this.contentService.getUnanalyzed(sourceId, timeframe);

    const run = await this.runService.start({
      type: 'content',
      scopeRef: sourceId,
      timeframe,
      total: items.length,
      triggeredBy: triggeredBy ?? null,
    });

    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.analyzeContent(item.id, run.id);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `تحلیل محتوای ${item.id} در اجرای ${run.id} ناموفق بود: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const finished = await this.runService.finish(run, { succeeded, failed });

    return {
      runId: finished.id,
      total: finished.total,
      succeeded: finished.succeeded,
      failed: finished.failed,
      status: finished.status,
    };
  }

  /* ------------------------------------------------------------------ */
  /* کمکی‌های داخلی                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * دوگانه‌نویسی اتمیک نتیجهٔ تحلیل (Requirement 13.5/13.6 — تسک ۵.۹). تنها در
   * مسیر موفق فراخوانی می‌شود (Requirement 7.1/7.5).
   *
   * هر دو نوشتن داخل **یک تراکنش** و با همان `EntityManager` انجام می‌شوند تا
   * هر دو با هم commit یا با هم rollback شوند (هیچ مسیر نوشتنِ تک‌محلی وجود
   * ندارد):
   *  1. درج رکورد جدید `content_analysis_results`.
   *  2. به‌روزرسانی ستون‌های قدیمی همان `posts` (`id = contentId`) با مقادیر
   *     معادل: `sentiment_score`/`sentiment_label`/`extracted_keywords`/
   *     `extracted_topics`.
   *
   * نگاشت معادل‌سازی (design §8.3، Property 6):
   *  - `posts.sentiment_score` ← `output.sentiment.score` (برابر با
   *    `content_analysis_results.sentiment_score`).
   *  - `posts.extracted_keywords` ← `output.keywords` (مجموعهٔ معادل با
   *    `content_analysis_results.keywords`).
   */
  private async persistResult(
    contentId: number,
    output: ContentAnalysisOutput,
    snapshot: { versionId?: number; model: string },
    execution: AiExecutionResult,
    analysisRunId?: number,
  ): Promise<ContentAnalysisResultEntity> {
    return this.dataSource.transaction(async (manager) => {
      // (۱) رکورد جدید structured در content_analysis_results.
      const entity = this.resultRepository.create({
        content_id: contentId,
        analysis_run_id: analysisRunId ?? null,
        prompt_version_id: snapshot.versionId ?? null,
        model: snapshot.model || null,
        sentiment_score: output.sentiment.score,
        sentiment_label: output.sentiment.label,
        sentiment_reason: output.sentiment.reason || null,
        keywords: output.keywords,
        topics: output.topics,
        summary_fa: output.summary_fa || null,
        is_relevant: output.is_relevant,
        coverage_type: output.coverage_type || null,
        narrative_position: output.narrative_position || null,
        risk_level: output.risk_level || null,
        recommended_attention: output.recommended_attention || null,
      });
      const saved = await manager.save(ContentAnalysisResultEntity, entity);

      // (۲) دوگانه‌نویسی به ستون‌های قدیمی posts با مقادیر معادل — در همان تراکنش.
      // اگر این به‌روزرسانی شکست بخورد، درج مرحلهٔ (۱) نیز rollback می‌شود.
      await manager.update(
        Post,
        { id: contentId },
        {
          sentiment_score: output.sentiment.score,
          sentiment_label: output.sentiment.label,
          extracted_keywords: output.keywords,
          extracted_topics: output.topics,
        },
      );

      return saved;
    });
  }

  /** ساخت ورودی prompt از فیلدهای محتوا (caption/متن استخراج‌شده/زمینه). */
  private buildInput(content: ContentItem): Record<string, unknown> {
    return {
      content_id: content.id,
      caption: content.caption ?? content.caption_fa ?? '',
      caption_fa: content.caption_fa ?? '',
      ocr_text: content.ocr_text ?? '',
      transcription: content.transcription ?? content.transcription_fa ?? '',
      manual_context: content.manual_context ?? '',
      post_type: content.post_type ?? '',
      published_at: content.published_at ?? null,
    };
  }

  /**
   * نگاشت یک `AiExecutionResult` ناموفق به `DomainException` با کد نمادین مناسب
   * (Requirement 7.5 / 5.x). validation → VALIDATION_ERROR، timeout →
   * AI_TIMEOUT، provider → AI_PROVIDER_ERROR.
   */
  private toDomainException(
    execution: AiExecutionResult,
    contentId: number,
  ): DomainException {
    const detail =
      execution.errorMessage ??
      execution.validationErrors?.join('؛ ') ??
      'خطای نامشخص در اجرای تحلیل';

    switch (execution.status) {
      case 'validation_error':
        return new DomainException(
          ERROR_CODES.VALIDATION_ERROR,
          `خروجی تحلیل محتوای ${contentId} با schema هم‌خوان نبود`,
          { details: execution.validationErrors },
        );
      case 'timeout':
        return new DomainException(
          ERROR_CODES.AI_TIMEOUT,
          `اجرای تحلیل محتوای ${contentId} به مهلت تعیین‌شده نرسید`,
        );
      case 'provider_error':
      default:
        return new DomainException(
          ERROR_CODES.AI_PROVIDER_ERROR,
          `اجرای تحلیل محتوای ${contentId} با خطای provider مواجه شد: ${detail}`,
        );
    }
  }
}
