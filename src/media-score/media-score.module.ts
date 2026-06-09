import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaScoreIndicatorEntity } from './media-score-indicator.entity';
import { MediaScoreRecordEntity } from './media-score-record.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { User } from '../modules/user/user.entity';
import { MediaScoreController } from './media-score.controller';
import { MediaScoreService } from './media-score.service';
import { AccessModule } from '../access/access.module';

/**
 * MediaScoreModule — شاخص‌ها و رکوردهای امتیاز انسانی (design §3.5).
 * `MediaScoreService` صادر می‌شود تا MicroMediaModule بتواند زیرمسیر
 * `/micro-media/:id/scores` را delegate کند.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MediaScoreIndicatorEntity,
      MediaScoreRecordEntity,
      MicroMediaEntity,
      User,
    ]),
    AccessModule,
  ],
  controllers: [MediaScoreController],
  providers: [MediaScoreService],
  exports: [MediaScoreService],
})
export class MediaScoreModule {}
