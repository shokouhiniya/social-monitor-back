import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../post/post.entity';
import { TranscriptionService } from './transcription.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
