import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './page.entity';
import { Post } from '../post/post.entity';
import { FieldReport } from '../field-report/field-report.entity';
import { ActionPlan } from '../action-plan/action-plan.entity';
import { PageController } from './page.controller';
import { PageService } from './page.service';
import { SettingsModule } from '../settings/settings.module';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Post, FieldReport, ActionPlan]), SettingsModule, TranscriptionModule],
  controllers: [PageController],
  providers: [PageService],
  exports: [PageService],
})
export class PageModule {}
