import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './task.entity';
import { TaskTagEntity } from './task-tag.entity';
import { HubEntity } from '../hubs/hub.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { OperationEntity } from '../campaigns/operation.entity';
import { User } from '../modules/user/user.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { AccessModule } from '../access/access.module';

/**
 * TasksModule — تسک‌های انسانی محصول جدید (design §3.7). جدا از action_plans
 * legacy. `TasksService` صادر می‌شود تا CampaignsModule بتواند taskهای عملیات
 * را بسازد.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskTagEntity,
      HubEntity,
      MicroMediaEntity,
      OperationEntity,
      User,
    ]),
    AccessModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
