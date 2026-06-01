import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptDefinition } from './prompt-definition.entity';
import { PromptVersion } from './prompt-version.entity';
import {
  PROMPT_SEED_DEFINITIONS,
  PromptSeedDefinition,
} from './prompt-seed.constants';

/**
 * سرویس seed promptهای اولیه (Requirement 6.1 / design §5.7).
 *
 * **تصمیم مرزی (هم‌راستا با `ClustersSeedService` تسک ۳.۹):** این سرویس عمداً
 * `OnModuleInit` را پیاده **نمی‌کند** و هنگام بالا آمدن برنامه به‌صورت خودکار
 * اجرا نمی‌شود. منطق seed به‌صورت متد عمومی idempotent (`seed()`) در دسترس است
 * تا اجرای دستی (مثلاً از یک اسکریپت seed یا endpoint مدیریتی) امن باشد.
 *
 * **idempotency:** seed بر اساس یکتایی `key` در `prompt_definitions` انجام
 * می‌شود؛ promptهای موجود دوباره ساخته نمی‌شوند. برای هر prompتِ تازه‌ساخته‌شده
 * یک نسخهٔ اولیه (version = 1, is_active = true) ایجاد می‌شود. اگر یک
 * `PromptDefinition` از قبل وجود داشته باشد ولی هیچ نسخه‌ای نداشته باشد، تنها
 * نسخهٔ اولیهٔ آن افزوده می‌شود (بدون ساخت دوبارهٔ تعریف).
 */
@Injectable()
export class PromptsSeedService {
  private readonly logger = new Logger(PromptsSeedService.name);

  constructor(
    @InjectRepository(PromptDefinition)
    private readonly definitionRepository: Repository<PromptDefinition>,
    @InjectRepository(PromptVersion)
    private readonly versionRepository: Repository<PromptVersion>,
  ) {}

  /**
   * seed کامل و idempotent همهٔ promptهای اولیه. تعداد تعاریف و نسخه‌های
   * تازه‌ساخته‌شده را برمی‌گرداند.
   */
  async seed(): Promise<{ definitionsSeeded: number; versionsSeeded: number }> {
    let definitionsSeeded = 0;
    let versionsSeeded = 0;

    for (const seed of PROMPT_SEED_DEFINITIONS) {
      const result = await this.seedOne(seed);
      definitionsSeeded += result.definitionCreated ? 1 : 0;
      versionsSeeded += result.versionCreated ? 1 : 0;
    }

    if (definitionsSeeded > 0 || versionsSeeded > 0) {
      this.logger.log(
        `✅ Seeded ${definitionsSeeded} prompt definitions and ${versionsSeeded} initial versions`,
      );
    } else {
      this.logger.log('✅ All prompts already seeded — skipping');
    }

    return { definitionsSeeded, versionsSeeded };
  }

  /**
   * seed یک prompt منفرد به‌صورت idempotent. اگر تعریف وجود نداشته باشد ساخته
   * می‌شود؛ اگر نسخه‌ای نداشته باشد یک نسخهٔ اولیهٔ فعال افزوده می‌شود.
   */
  private async seedOne(
    seed: PromptSeedDefinition,
  ): Promise<{ definitionCreated: boolean; versionCreated: boolean }> {
    let definition = await this.definitionRepository.findOne({
      where: { key: seed.key },
    });
    let definitionCreated = false;

    if (!definition) {
      definition = await this.definitionRepository.save(
        this.definitionRepository.create({
          key: seed.key,
          title: seed.title,
          description: seed.description,
          category: seed.category,
          default_model: seed.default_model,
          output_schema: seed.output_schema ?? null,
          is_active: true,
        }),
      );
      definitionCreated = true;
    }

    // اگر تعریف از قبل نسخه دارد، نسخهٔ اولیه دوباره ساخته نمی‌شود (idempotent).
    const existingVersions = await this.versionRepository.count({
      where: { prompt_definition_id: definition.id },
    });
    if (existingVersions > 0) {
      return { definitionCreated, versionCreated: false };
    }

    await this.versionRepository.save(
      this.versionRepository.create({
        prompt_definition_id: definition.id,
        version: 1,
        template: seed.template,
        extra_instructions: seed.extra_instructions ?? null,
        model: seed.default_model,
        temperature:
          seed.temperature !== undefined ? seed.temperature : null,
        response_format: seed.response_format,
        created_by: null,
        is_active: true,
      }),
    );

    return { definitionCreated, versionCreated: true };
  }
}
