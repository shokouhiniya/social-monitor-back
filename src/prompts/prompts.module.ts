import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiExecutionLog } from '../ai/ai-execution-log.entity';
import { AiModule } from '../ai/ai.module';
import { AuthV2Module } from '../auth/auth.module';
import { PromptDefinition } from './prompt-definition.entity';
import { PromptVersion } from './prompt-version.entity';
import { PromptsController } from './prompts.controller';
import { PromptsSeedService } from './prompts-seed.service';
import { PromptsService } from './prompts.service';

/**
 * PromptsModule — استودیوی Prompt با نسخه‌بندی ساده (design §5.7، Requirement 6).
 *
 * **مرز وابستگی (design §3.2):**
 *  - به `AiModule` وابسته است تا `AiService` را برای تست دستی prompt مصرف کند
 *    (Requirement 6.5)؛ ثبت لاگ اجرا توسط خود `AiService` انجام می‌شود
 *    (Requirement 6.6).
 *  - به `AuthV2Module` وابسته است تا `JwtAuthGuard`/`RolesGuard` را برای محافظت
 *    admin-only از endpointهای تغییردهنده در دسترس قرار دهد (Requirement 11.4).
 *  - `TypeOrmModule.forFeature` موجودیت‌های `PromptDefinition` و `PromptVersion`
 *    و نیز `AiExecutionLog` (برای `getExecutions` — Requirement 6.7) را ثبت
 *    می‌کند.
 *
 * `PromptsService` صادر می‌شود تا `AnalysisModule` (تسک ۵.۸) بتواند نسخهٔ فعال
 * prompt را resolve کند (`resolveActiveVersion` — Requirement 6.4).
 *
 * `PromptsSeedService` منطق seed promptهای اولیه را فراهم می‌کند اما به‌صورت
 * خودکار اجرا نمی‌شود (الگوی محتاطانهٔ `ClustersSeedService`)؛ seed دستی و
 * idempotent است.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromptDefinition,
      PromptVersion,
      AiExecutionLog,
    ]),
    AiModule,
    AuthV2Module,
  ],
  controllers: [PromptsController],
  providers: [PromptsService, PromptsSeedService],
  exports: [PromptsService, PromptsSeedService],
})
export class PromptsModule {}
