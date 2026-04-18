import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PageModule } from '../page/page.module';
import { PostModule } from '../post/post.module';
import { StrategicAlert } from '../strategic-alert/strategic-alert.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PageModule, PostModule, SettingsModule, TypeOrmModule.forFeature([StrategicAlert])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
