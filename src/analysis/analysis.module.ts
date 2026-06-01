import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { ContentModule } from '../content/content.module';
import { NetworksModule } from '../networks/networks.module';
import { PromptsModule } from '../prompts/prompts.module';
import { AnalysisRunService } from './analysis-run.service';
import { AnalysisService } from './analysis.service';
import { ContentAnalysisService } from './content-analysis.service';
import { NetworkAnalysisService } from './network-analysis.service';
import { SourceInsightService } from './source-insight.service';
import { AnalysisRunEntity } from './entities/analysis-run.entity';
import { ContentAnalysisResultEntity } from './entities/content-analysis-result.entity';
import { NetworkReportResultEntity } from './entities/network-report-result.entity';
import { SourceInsightResultEntity } from './entities/source-insight-result.entity';

/**
 * AnalysisModule — لایهٔ orchestration تحلیل (design §5.8، Requirement 7).
 *
 * **مرز وابستگی (design §3.2):**
 *  - `PromptsModule` برای resolve نسخهٔ فعال prompt (`resolveActiveVersion` —
 *    Requirement 7.1/7.3/7.4).
 *  - `AiModule` برای اجرای prompt از طریق `AiService` (لایهٔ low-level مستقل).
 *  - `ContentModule` برای واکشی محتوای تحلیل‌نشده/پراثر (`getUnanalyzed`,
 *    `getHighImpact`, `findById`).
 *  - `NetworksModule` برای اعتبارسنجی شبکه در گزارش شبکه.
 *  - `TypeOrmModule.forFeature` چهار موجودیت نتیجه + رکورد ردیابی
 *    `analysis_runs` را ثبت می‌کند (هم‌خوان با مهاجرت
 *    `Phase3AnalysisResults1739400000000`).
 *
 * `AnalysisService` (facade) صادر می‌شود تا در تسک ۵.۱۱ به‌عنوان
 * `SOURCES_ANALYSIS_DELEGATE` به `SourcesModule` و در فاز Job (تسک ۷.۶) به
 * worker وصل شود. در `app.module.ts` به‌صورت dual-import ثبت می‌شود
 * (Requirement 1.6).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalysisRunEntity,
      ContentAnalysisResultEntity,
      SourceInsightResultEntity,
      NetworkReportResultEntity,
    ]),
    PromptsModule,
    AiModule,
    ContentModule,
    NetworksModule,
  ],
  providers: [
    AnalysisService,
    ContentAnalysisService,
    SourceInsightService,
    NetworkAnalysisService,
    AnalysisRunService,
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
