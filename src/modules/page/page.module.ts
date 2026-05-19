import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './page.entity';
import { Post } from '../post/post.entity';
import { FieldReport } from '../field-report/field-report.entity';
import { ActionPlan } from '../action-plan/action-plan.entity';
import { Cluster } from '../cluster/cluster.entity';
import { PageController } from './page.controller';
import { PageService } from './page.service';
import { BatchRefreshService } from './batch-refresh.service';
import { SettingsModule } from '../settings/settings.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, Post, FieldReport, ActionPlan, Cluster]),
    SettingsModule,
    TranscriptionModule,
    forwardRef(() => AnalyticsModule),
  ],
  controllers: [PageController],
  providers: [PageService, BatchRefreshService],
  exports: [PageService],
})
export class PageModule {}
