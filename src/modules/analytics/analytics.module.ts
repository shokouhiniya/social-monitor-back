import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PageModule } from '../page/page.module';
import { PostModule } from '../post/post.module';

@Module({
  imports: [PageModule, PostModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
