import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { MediaScoreRecordEntity } from '../media-score/media-score-record.entity';
import { HubEntity } from '../hubs/hub.entity';
import { OperationEntity } from '../campaigns/operation.entity';
import { OperationMediaEntity } from '../campaigns/operation-media.entity';
import { OperationOutputEntity } from '../campaigns/operation-output.entity';
import { TaskEntity } from '../tasks/task.entity';
import { Interaction } from '../modules/interaction/interaction.entity';
import { ManagementDashboardsController } from './management-dashboards.controller';
import { ManagementDashboardsService } from './management-dashboards.service';
import { AccessModule } from '../access/access.module';

/**
 * ManagementDashboardsModule — تجمیع فقط‌خواندنی برای داشبوردهای مدیریتی
 * (design §4، plan §6.7). فقط از جدول‌های موجود می‌خواند؛ بدون نوشتن.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MicroMediaEntity,
      MediaScoreRecordEntity,
      HubEntity,
      OperationEntity,
      OperationMediaEntity,
      OperationOutputEntity,
      TaskEntity,
      Interaction,
    ]),
    AccessModule,
  ],
  controllers: [ManagementDashboardsController],
  providers: [ManagementDashboardsService],
})
export class ManagementDashboardsModule {}
