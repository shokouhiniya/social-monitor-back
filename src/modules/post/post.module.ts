import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { TranscriptionModule } from '../transcription/transcription.module';
import { SettingsModule } from '../settings/settings.module';
// سازگاری دورهٔ گذار (Requirement 3.6): مسیرهای legacy `/posts` به‌تدریج به
// ContentService واگذار می‌شوند. ContentModule به PostModule وابسته نیست،
// بنابراین این import بدون forwardRef و بدون ایجاد دور (acyclic) است.
import { ContentModule } from '../../content/content.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    TranscriptionModule,
    SettingsModule,
    ContentModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
