import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwitterService } from './twitter.service';
import { TwitterController } from './twitter.controller';
import { Page } from '../page/page.entity';
import { Post } from '../post/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Post])],
  controllers: [TwitterController],
  providers: [TwitterService],
  exports: [TwitterService],
})
export class TwitterModule {}
