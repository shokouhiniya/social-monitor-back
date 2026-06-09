import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationEntity } from './operation.entity';
import { OperationMediaEntity } from './operation-media.entity';
import { OperationOutputEntity } from './operation-output.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { TaskEntity } from '../tasks/task.entity';
import { User } from '../modules/user/user.entity';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { TasksModule } from '../tasks/tasks.module';
import { AccessModule } from '../access/access.module';

/**
 * CampaignsModule — عملیات/کمپین (design §3.8، تصمیم ۴). روی `/campaigns`.
 * `TasksModule` import می‌شود تا تسک‌های عملیات از طریق `TasksService` ساخته شوند.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OperationEntity,
      OperationMediaEntity,
      OperationOutputEntity,
      MicroMediaEntity,
      TaskEntity,
      User,
    ]),
    TasksModule,
    AccessModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
