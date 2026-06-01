import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiExecutionResult } from '../ai/ai.types';
import { AiService } from '../ai/ai.service';
import { DomainException, ERROR_CODES } from '../common/exceptions';
import { ContentService } from '../content/content.service';
import { PromptsService } from '../prompts/prompts.service';
import { AnalysisRunService } from './analysis-run.service';
import { SOURCE_INSIGHT_PROMPT_KEY } from './analysis.types';
import { SourceInsightResultEntity } from './entities/source-insight-result.entity';
import {
  SOURCE_INSIGHT_OUTPUT_SCHEMA,
  SourceInsightOutput,
  extractSourceInsight,
} from './schemas/source-insight.schema';

/**
 * سرویس تولید بینش منبع (design §5.8، Requirement 7.3/7.5/7.6).
 *
 * `generateSourceInsight(sourceId)`: نسخهٔ فعال prompt
 * `source_narrative_insight` را resolve می‌کند، از طریق `AiService` اجرا می‌کند
 * و یک `source_insight_results` مطابق schema ذخیره می‌کند (Requirement 7.3).
 * در صورت `validation_error` خروجی نامعتبر ذخیره نمی‌شود (Requirement 7.5) و یک
 * `analysis_runs` با وضعیت متناظر ثبت می‌شود (Requirement 7.6).
 */
@Injectable()
export class SourceInsightService {
  /** بیشینهٔ تعداد محتوای اخیر که برای ساخت بینش به prompt تزریق می‌شود. */
  private static readonly INSIGHT_CONTENT_LIMIT = 50;

  constructor(
    @InjectRepository(SourceInsightResultEntity)
    private readonly insightRepository: Repository<SourceInsightResultEntity>,
    private readonly contentService: ContentService,
    private readonly promptsService: PromptsService,
    private readonly aiService: AiService,
    private readonly runService: AnalysisRunService,
  ) {}

  /**
   * تولید و ذخیرهٔ بینش یک منبع (Requirement 7.3).
   *
   * یک رکورد `analysis_runs` از نوع `source_insight` با `total = 1` ساخته
   * می‌شود؛ در صورت موفقیت `succeeded = 1` و در صورت شکست `failed = 1` ثبت و
   * وضعیت نهایی محاسبه می‌شود (Requirement 7.6).
   */
  async generateSourceInsight(
    sourceId: number,
    triggeredBy?: number,
  ): Promise<SourceInsightResultEntity> {
    const run = await this.runService.start({
      type: 'source_insight',
      scopeRef: sourceId,
      total: 1,
      triggeredBy: triggeredBy ?? null,
    });

    try {
      const snapshot = await this.promptsService.resolveActiveVersion(
        SOURCE_INSIGHT_PROMPT_KEY,
      );

      const recentContent = await this.contentService.getHighImpact({
        sourceId,
        limit: SourceInsightService.INSIGHT_CONTENT_LIMIT,
      });

      const execution = await this.aiService.execute({
        promptKey: SOURCE_INSIGHT_PROMPT_KEY,
        version: {
          ...snapshot,
          output_schema:
            snapshot.output_schema ?? SOURCE_INSIGHT_OUTPUT_SCHEMA,
        },
        input: {
          source_id: sourceId,
          content_count: recentContent.length,
          content_samples: recentContent.map((c) => ({
            caption: c.caption ?? c.caption_fa ?? '',
            post_type: c.post_type ?? '',
            sentiment_label: c.sentiment_label ?? null,
          })),
        },
        entityRef: { type: 'source', id: sourceId },
      });

      if (execution.status !== 'success') {
        throw this.toDomainException(execution, sourceId);
      }

      const output = extractSourceInsight(execution.parsed);
      if (!output) {
        throw new DomainException(
          ERROR_CODES.VALIDATION_ERROR,
          `خروجی بینش منبع ${sourceId} با schema هم‌خوان نبود`,
        );
      }

      const saved = await this.persistResult(
        sourceId,
        output,
        snapshot,
        run.id,
      );
      await this.runService.finish(run, { succeeded: 1, failed: 0 });
      return saved;
    } catch (error) {
      await this.runService.finish(run, { succeeded: 0, failed: 1 });
      throw error;
    }
  }

  /* ------------------------------------------------------------------ */
  /* کمکی‌های داخلی                                                      */
  /* ------------------------------------------------------------------ */

  /** ذخیرهٔ نتیجهٔ structured بینش در `source_insight_results` (مسیر موفق). */
  private async persistResult(
    sourceId: number,
    output: SourceInsightOutput,
    snapshot: { versionId?: number; model: string },
    analysisRunId: number,
  ): Promise<SourceInsightResultEntity> {
    const entity = this.insightRepository.create({
      source_id: sourceId,
      analysis_run_id: analysisRunId,
      prompt_version_id: snapshot.versionId ?? null,
      model: snapshot.model || null,
      narrative_description: output.narrative_description || null,
      audience_description: output.audience_description || null,
      engagement_suggestion: output.engagement_suggestion || null,
      persona_radar: output.persona_radar,
      pain_points: output.pain_points,
      topic_distribution: output.topic_distribution,
      strategic_notes: output.strategic_notes,
    });
    return this.insightRepository.save(entity);
  }

  /** نگاشت یک نتیجهٔ ناموفق AI به `DomainException` با کد نمادین مناسب. */
  private toDomainException(
    execution: AiExecutionResult,
    sourceId: number,
  ): DomainException {
    const detail =
      execution.errorMessage ??
      execution.validationErrors?.join('؛ ') ??
      'خطای نامشخص در اجرای بینش';

    switch (execution.status) {
      case 'validation_error':
        return new DomainException(
          ERROR_CODES.VALIDATION_ERROR,
          `خروجی بینش منبع ${sourceId} با schema هم‌خوان نبود`,
          { details: execution.validationErrors },
        );
      case 'timeout':
        return new DomainException(
          ERROR_CODES.AI_TIMEOUT,
          `اجرای بینش منبع ${sourceId} به مهلت تعیین‌شده نرسید`,
        );
      case 'provider_error':
      default:
        return new DomainException(
          ERROR_CODES.AI_PROVIDER_ERROR,
          `اجرای بینش منبع ${sourceId} با خطای provider مواجه شد: ${detail}`,
        );
    }
  }
}
