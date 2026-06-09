import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MicroMediaEntity } from './micro-media.entity';
import { MicroMediaTagEntity } from './micro-media-tag.entity';
import { MediaPerformanceSnapshotEntity } from './media-performance-snapshot.entity';
import { Page } from '../modules/page/page.entity';
import { Post } from '../modules/post/post.entity';
import { User } from '../modules/user/user.entity';
import { Interaction } from '../modules/interaction/interaction.entity';
import { MicroMediaController } from './micro-media.controller';
import { MicroMediaService } from './micro-media.service';
import { InteractionsV2Service } from './interactions-v2.service';
import { InteractionsV2Controller } from './interactions-v2.controller';
import { MediaScoreModule } from '../media-score/media-score.module';
import { AccessModule } from '../access/access.module';

/**
 * MicroMediaModule — واحد مرکزی محصول جدید (design §3.2, §4).
 *
 * بازکاربری entityهای موجود `Page` و `Interaction` (بدون entity دوم — درس As-Is).
 * `MediaScoreModule` import می‌شود تا زیرمسیر `/micro-media/:id/scores` به
 * `MediaScoreService` delegate شود.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MicroMediaEntity,
      MicroMediaTagEntity,
      MediaPerformanceSnapshotEntity,
      Page,
      Post,
      User,
      Interaction,
    ]),
    MediaScoreModule,
    AccessModule,
  ],
  controllers: [MicroMediaController, InteractionsV2Controller],
  providers: [MicroMediaService, InteractionsV2Service],
  exports: [MicroMediaService, InteractionsV2Service],
})
export class MicroMediaModule {}
