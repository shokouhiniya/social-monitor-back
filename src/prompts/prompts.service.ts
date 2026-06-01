import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiExecutionLog } from '../ai/ai-execution-log.entity';
import { AiService } from '../ai/ai.service';
import {
  AiExecutionResult,
  PromptVersionSnapshot,
} from '../ai/ai.types';
import { ConflictException, NotFoundException } from '../common/exceptions';
import {
  NormalizedPagination,
  Paginated,
  normalizePagination,
  paginate,
} from '../common/pagination';
import { CreatePromptVersionDto } from './prompts.dto';
import { PromptDefinition } from './prompt-definition.entity';
import { PromptVersion } from './prompt-version.entity';
import { PromptDefinitionWithVersions } from './prompt.types';

/**
 * سرویس هستهٔ Prompt Studio (PromptsService — design §5.7، Requirement 6).
 *
 * **مسئولیت‌ها:** فهرست تعاریف prompt، نسخه‌بندی افزایشی، فعال‌سازی تک‌نسخه‌ای،
 * resolve نسخهٔ فعال برای `AnalysisService`، تست دستی از طریق `AiService`،
 * تاریخچهٔ صفحه‌بندی‌شدهٔ اجراها و enable/disable.
 *
 * **مرز وابستگی (design §3.2):** این سرویس به `AiModule` وابسته است (برای تست
 * دستی prompt) ولی به دامنهٔ تحلیل وابسته نیست. ثبت لاگ اجرا توسط خود
 * `AiService` انجام می‌شود (Requirement 5.6/6.6)؛ این سرویس صرفاً لاگ‌ها را
 * می‌خواند (`getExecutions`).
 *
 * از `DomainException` (`NotFoundException`/`ConflictException`) استفاده می‌کند
 * تا با AllExceptionsFilter سراسری و Response Envelope یکدست سازگار باشد
 * (Requirement 12.4).
 */
@Injectable()
export class PromptsService {
  constructor(
    @InjectRepository(PromptDefinition)
    private readonly definitionRepository: Repository<PromptDefinition>,
    @InjectRepository(PromptVersion)
    private readonly versionRepository: Repository<PromptVersion>,
    @InjectRepository(AiExecutionLog)
    private readonly executionLogRepository: Repository<AiExecutionLog>,
    private readonly aiService: AiService,
    private readonly dataSource: DataSource,
  ) {}

  /** فهرست همهٔ تعاریف prompt (Requirement 6.1). */
  async listDefinitions(): Promise<PromptDefinition[]> {
    return this.definitionRepository.find({
      order: { id: 'ASC' },
    });
  }

  /**
   * جزئیات یک prompt به‌همراه همهٔ نسخه‌ها و شناسهٔ نسخهٔ فعال (design §5.7).
   * NotFound در صورت نبود prompt با این `key`.
   */
  async getByKey(key: string): Promise<PromptDefinitionWithVersions> {
    const definition = await this.requireDefinition(key);
    const versions = await this.versionRepository.find({
      where: { prompt_definition_id: definition.id },
      order: { version: 'ASC' },
    });
    const activeVersion = versions.find((v) => v.is_active) ?? null;

    return {
      ...definition,
      versions,
      active_version_id: activeVersion ? activeVersion.id : null,
    };
  }

  /**
   * ساخت یک نسخهٔ جدید با شمارهٔ نسخهٔ افزایشی به‌ازای همان prompt
   * (Requirement 6.2).
   *
   * شمارهٔ نسخه = (بیشینهٔ نسخهٔ موجود برای این prompt) + ۱؛ اولین نسخه ۱ است.
   * نسخهٔ جدید به‌صورت پیش‌فرض غیرفعال است؛ فعال‌سازی از طریق `activateVersion`
   * انجام می‌شود (Requirement 6.3).
   */
  async createVersion(
    key: string,
    dto: CreatePromptVersionDto,
    userId?: number,
  ): Promise<PromptVersion> {
    const definition = await this.requireDefinition(key);
    const nextVersion = await this.nextVersionNumber(definition.id);

    const version = this.versionRepository.create({
      prompt_definition_id: definition.id,
      version: nextVersion,
      template: dto.template,
      extra_instructions: dto.extra_instructions ?? null,
      model: dto.model ?? definition.default_model ?? null,
      temperature:
        dto.temperature !== undefined && dto.temperature !== null
          ? dto.temperature
          : null,
      response_format: dto.response_format ?? null,
      created_by: userId ?? null,
      is_active: false,
    });

    return this.versionRepository.save(version);
  }

  /**
   * فعال‌سازی یک نسخهٔ مشخص: تنها همان نسخه فعال می‌شود و نسخهٔ فعال قبلی
   * غیرفعال می‌شود (Requirement 6.3).
   *
   * این عملیات درون یک transaction انجام می‌شود تا ناوردای «دقیقاً یک نسخهٔ
   * فعال به‌ازای هر prompt» به‌صورت اتمیک حفظ شود: ابتدا همهٔ نسخه‌های این prompt
   * غیرفعال و سپس نسخهٔ هدف فعال می‌شود.
   */
  async activateVersion(
    key: string,
    versionId: number,
    _userId?: number,
  ): Promise<PromptVersion> {
    const definition = await this.requireDefinition(key);
    const version = await this.versionRepository.findOne({
      where: { id: versionId, prompt_definition_id: definition.id },
    });
    if (!version) {
      throw new NotFoundException(
        `نسخه‌ای با شناسهٔ ${versionId} برای prompt «${key}» یافت نشد`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // ابتدا همهٔ نسخه‌های این prompt غیرفعال می‌شوند.
      await manager.update(
        PromptVersion,
        { prompt_definition_id: definition.id },
        { is_active: false },
      );
      // سپس تنها نسخهٔ هدف فعال می‌شود (تضمین «دقیقاً یک نسخهٔ فعال»).
      await manager.update(
        PromptVersion,
        { id: version.id },
        { is_active: true },
      );
    });

    version.is_active = true;
    return version;
  }

  /**
   * resolve نسخهٔ فعال یک prompt به‌صورت `PromptVersionSnapshot` برای مصرف
   * `AnalysisService`/`AiService` (Requirement 6.4، design §5.7).
   *
   * NotFound اگر prompt وجود نداشته باشد یا هیچ نسخهٔ فعالی نداشته باشد.
   */
  async resolveActiveVersion(key: string): Promise<PromptVersionSnapshot> {
    const definition = await this.requireDefinition(key);
    const active = await this.versionRepository.findOne({
      where: { prompt_definition_id: definition.id, is_active: true },
    });
    if (!active) {
      throw new NotFoundException(
        `prompt «${key}» نسخهٔ فعالی ندارد`,
      );
    }
    return this.toSnapshot(active, definition);
  }

  /**
   * تست دستی یک prompt با ورودی نمونه از طریق `AiService` (Requirement 6.5).
   *
   * نسخهٔ مشخص‌شده (`versionId`) یا — در نبود آن — نسخهٔ فعال اجرا می‌شود.
   * `AiService` خودش رکورد را در `ai_execution_logs` ثبت می‌کند
   * (Requirement 6.6).
   */
  async test(
    key: string,
    sampleInput: Record<string, unknown>,
    versionId?: number,
  ): Promise<AiExecutionResult> {
    const definition = await this.requireDefinition(key);
    const snapshot = await this.resolveSnapshotForTest(
      definition,
      key,
      versionId,
    );

    return this.aiService.execute({
      promptKey: key,
      version: snapshot,
      input: sampleInput ?? {},
    });
  }

  /**
   * فهرست صفحه‌بندی‌شدهٔ اجراهای یک prompt از `ai_execution_logs`
   * (Requirement 6.7). جدیدترین اجراها ابتدا.
   */
  async getExecutions(
    key: string,
    query: { page?: number | string; pageSize?: number | string } = {},
  ): Promise<Paginated<AiExecutionLog>> {
    // اطمینان از وجود prompt تا 404 معنادار بازگردد (به‌جای فهرست خالی مبهم).
    await this.requireDefinition(key);

    const pagination: NormalizedPagination = normalizePagination(query);
    const [items, total] = await this.executionLogRepository.findAndCount({
      where: { prompt_key: key },
      order: { created_at: 'DESC', id: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items, total, pagination);
  }

  /**
   * فعال/غیرفعال کردن یک prompt با تنظیم `is_active` روی `PromptDefinition`
   * (Requirement 6.8).
   */
  async setActive(key: string, isActive: boolean): Promise<PromptDefinition> {
    const definition = await this.requireDefinition(key);
    definition.is_active = isActive;
    return this.definitionRepository.save(definition);
  }

  /* ------------------------------------------------------------------ */
  /* کمکی‌های داخلی                                                      */
  /* ------------------------------------------------------------------ */

  /** یافتن یک تعریف prompt یا پرتاب NotFoundException در صورت نبود. */
  private async requireDefinition(key: string): Promise<PromptDefinition> {
    const definition = await this.definitionRepository.findOne({
      where: { key },
    });
    if (!definition) {
      throw new NotFoundException(`prompt با کلید «${key}» یافت نشد`);
    }
    return definition;
  }

  /**
   * محاسبهٔ شمارهٔ نسخهٔ بعدی برای یک prompt: بیشینهٔ نسخهٔ موجود + ۱ (یا ۱ اگر
   * نسخه‌ای وجود ندارد). جستجوی مرتب‌شدهٔ نزولی برای یافتن بیشینه.
   */
  private async nextVersionNumber(definitionId: number): Promise<number> {
    const latest = await this.versionRepository.findOne({
      where: { prompt_definition_id: definitionId },
      order: { version: 'DESC' },
    });
    return latest ? latest.version + 1 : 1;
  }

  /**
   * نگاشت یک `PromptVersion` + `PromptDefinition` به `PromptVersionSnapshot`
   * مصرفی لایهٔ AI. `output_schema` از تعریف prompt برداشته می‌شود.
   */
  private toSnapshot(
    version: PromptVersion,
    definition: PromptDefinition,
  ): PromptVersionSnapshot {
    return {
      template: version.template,
      model: version.model || definition.default_model || '',
      temperature:
        version.temperature !== null && version.temperature !== undefined
          ? version.temperature
          : undefined,
      response_format: version.response_format ?? undefined,
      extra_instructions: version.extra_instructions ?? undefined,
      output_schema: definition.output_schema ?? null,
      versionId: version.id,
    };
  }

  /**
   * resolve نسخهٔ مورد استفاده برای تست: نسخهٔ مشخص‌شده (در صورت ارائهٔ
   * `versionId` و تعلق آن به همان prompt) یا نسخهٔ فعال.
   */
  private async resolveSnapshotForTest(
    definition: PromptDefinition,
    key: string,
    versionId?: number,
  ): Promise<PromptVersionSnapshot> {
    if (versionId !== undefined && versionId !== null) {
      const version = await this.versionRepository.findOne({
        where: { id: versionId, prompt_definition_id: definition.id },
      });
      if (!version) {
        throw new NotFoundException(
          `نسخه‌ای با شناسهٔ ${versionId} برای prompt «${key}» یافت نشد`,
        );
      }
      return this.toSnapshot(version, definition);
    }

    const active = await this.versionRepository.findOne({
      where: { prompt_definition_id: definition.id, is_active: true },
    });
    if (!active) {
      throw new NotFoundException(
        `prompt «${key}» نسخهٔ فعالی برای تست ندارد؛ یک نسخه ایجاد و فعال کنید`,
      );
    }
    return this.toSnapshot(active, definition);
  }
}
