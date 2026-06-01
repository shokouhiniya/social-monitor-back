import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiExecutionResult } from '../ai/ai.types';
import { AiService } from '../ai/ai.service';
import { DomainException, ERROR_CODES } from '../common/exceptions';
import { NetworksService } from '../networks/networks.service';
import { PromptsService } from '../prompts/prompts.service';
import { AnalysisRunService } from './analysis-run.service';
import { NETWORK_REPORT_PROMPT_KEY } from './analysis.types';
import { NetworkReportResultEntity } from './entities/network-report-result.entity';
import { normalizeNetworkReport } from './schemas/network-report.schema';

/**
 * سرویس تولید گزارش شبکه (design §5.8، Requirement 7.4/7.6).
 *
 * `generateNetworkReport(networkId)`: نسخهٔ فعال prompt `network_ai_summary`
 * (خلاصهٔ هوشمند شبکه) را resolve می‌کند، از طریق `AiService` اجرا می‌کند و یک
 * `network_report_results` ذخیره می‌کند. یک رکورد `analysis_runs` از نوع
 * `network_report` برای ردیابی ساخته/به‌روزرسانی می‌شود (Requirement 7.6).
 *
 * prompt پیش‌فرض `network_ai_summary` قالب `text` دارد؛ بنابراین خروجی موفق یک
 * رشته است که در `{ headline, report }` بسته‌بندی و در ستون jsonb `report` ذخیره
 * می‌شود. اگر در آینده از `periodic_report_generation` (قالب json) استفاده شود،
 * خروجی structured عیناً ذخیره می‌شود.
 */
@Injectable()
export class NetworkAnalysisService {
  constructor(
    @InjectRepository(NetworkReportResultEntity)
    private readonly reportRepository: Repository<NetworkReportResultEntity>,
    private readonly networksService: NetworksService,
    private readonly promptsService: PromptsService,
    private readonly aiService: AiService,
    private readonly runService: AnalysisRunService,
  ) {}

  /**
   * تولید و ذخیرهٔ گزارش یک شبکه (Requirement 7.4). وجود شبکه پیش از اجرا
   * بررسی می‌شود (NotFound در صورت نبود). در صورت شکست AI یک `DomainException`
   * با کد نمادین پرتاب و اجرا به‌عنوان failed ثبت می‌شود (Requirement 7.6).
   */
  async generateNetworkReport(
    networkId: number,
    triggeredBy?: number,
  ): Promise<NetworkReportResultEntity> {
    // اعتبارسنجی وجود شبکه (NotFoundException در صورت نبود).
    const network = await this.networksService.findById(networkId);

    const run = await this.runService.start({
      type: 'network_report',
      scopeRef: networkId,
      total: 1,
      triggeredBy: triggeredBy ?? null,
    });

    try {
      const snapshot = await this.promptsService.resolveActiveVersion(
        NETWORK_REPORT_PROMPT_KEY,
      );

      const execution = await this.aiService.execute({
        promptKey: NETWORK_REPORT_PROMPT_KEY,
        version: snapshot,
        input: {
          network_id: network.id,
          network_name: network.name,
        },
        entityRef: { type: 'network', id: networkId },
      });

      if (execution.status !== 'success') {
        throw this.toDomainException(execution, networkId);
      }

      const report = normalizeNetworkReport(execution.parsed ?? execution.raw);

      const entity = this.reportRepository.create({
        network_id: networkId,
        analysis_run_id: run.id,
        prompt_version_id: snapshot.versionId ?? null,
        model: snapshot.model || null,
        report,
        period_start: null,
        period_end: null,
      });
      const saved = await this.reportRepository.save(entity);

      await this.runService.finish(run, { succeeded: 1, failed: 0 });
      return saved;
    } catch (error) {
      await this.runService.finish(run, { succeeded: 0, failed: 1 });
      throw error;
    }
  }

  /** نگاشت یک نتیجهٔ ناموفق AI به `DomainException` با کد نمادین مناسب. */
  private toDomainException(
    execution: AiExecutionResult,
    networkId: number,
  ): DomainException {
    const detail =
      execution.errorMessage ??
      execution.validationErrors?.join('؛ ') ??
      'خطای نامشخص در تولید گزارش';

    switch (execution.status) {
      case 'validation_error':
        return new DomainException(
          ERROR_CODES.VALIDATION_ERROR,
          `خروجی گزارش شبکهٔ ${networkId} با schema هم‌خوان نبود`,
          { details: execution.validationErrors },
        );
      case 'timeout':
        return new DomainException(
          ERROR_CODES.AI_TIMEOUT,
          `تولید گزارش شبکهٔ ${networkId} به مهلت تعیین‌شده نرسید`,
        );
      case 'provider_error':
      default:
        return new DomainException(
          ERROR_CODES.AI_PROVIDER_ERROR,
          `تولید گزارش شبکهٔ ${networkId} با خطای provider مواجه شد: ${detail}`,
        );
    }
  }
}
