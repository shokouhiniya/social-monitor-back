import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../modules/settings/settings.module';
import { AiExecutionLog } from './ai-execution-log.entity';
import { AiService } from './ai.service';

/**
 * AiModule — لایهٔ low-level ارتباط با OpenRouter (design §5.6، Requirement 5).
 *
 * **قاعدهٔ وابستگی (Requirement 1.4 / design §3.2):** این ماژول **هیچ وابستگی به
 * دامنه** ندارد (نه Source، نه Content، نه Prompt). تنها به `SettingsModule`
 * برای resolve کلید/مدل OpenRouter و به `TypeOrmModule.forFeature` برای ثبت لاگ
 * اجرا در `ai_execution_logs` وابسته است. `AiService` صادر می‌شود تا توسط
 * لایه‌های بالاتر مصرف شود:
 *  - `PromptsModule` (تسک ۵.۵) برای تست دستی prompt.
 *  - `AnalysisModule` (تسک ۵.۸) برای اجرای تحلیل.
 *
 * ثبت لاگ اجرا (`ai_execution_logs`) در پایان هر اجرا توسط `AiService` انجام
 * می‌شود (Requirement 5.6) و موجودیت `AiExecutionLog` در اینجا register می‌شود.
 */
@Module({
  imports: [SettingsModule, TypeOrmModule.forFeature([AiExecutionLog])],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
