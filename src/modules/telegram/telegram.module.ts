import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { Page } from '../page/page.entity';
import { Post } from '../post/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Post])],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
