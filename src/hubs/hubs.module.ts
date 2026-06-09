import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubEntity } from './hub.entity';
import { HubUserEntity } from './hub-user.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { TaskEntity } from '../tasks/task.entity';
import { Interaction } from '../modules/interaction/interaction.entity';
import { User } from '../modules/user/user.entity';
import { HubsController } from './hubs.controller';
import { HubsService } from './hubs.service';
import { AccessModule } from '../access/access.module';

/**
 * HubsModule — ساختار مدیریتی هاب‌ها (design §3.1).
 * `HubsService` صادر می‌شود تا سرویس‌های دیگر از آن استفاده کنند.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      HubEntity,
      HubUserEntity,
      MicroMediaEntity,
      TaskEntity,
      Interaction,
      User,
    ]),
    AccessModule,
  ],
  controllers: [HubsController],
  providers: [HubsService],
  exports: [HubsService],
})
export class HubsModule {}
