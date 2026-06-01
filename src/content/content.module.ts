import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../modules/post/post.entity';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

/**
 * ContentModule — مدیریت محتوا (design §5.3).
 *
 * «ContentItem» روی همان جدول `posts` نگاشت می‌شود؛ بنابراین به‌جای تعریف یک
 * entity دوم، موجودیت موجود `Post` دوباره استفاده می‌شود
 * (`TypeOrmModule.forFeature([Post])`) تا تعارض metadata در TypeORM رخ ندهد —
 * دقیقاً مطابق الگوی `Source = Page` در `SourcesModule` (تسک ۳.۴).
 *
 * در `app.module.ts` به‌صورت dual-import در کنار `PostModule` و سایر ماژول‌های
 * legacy ثبت می‌شود (Requirement 1.6). `ContentService` صادر می‌شود تا:
 *  - مسیرهای legacy `/posts` بتوانند عملیات امن را delegate کنند (Requirement 3.6)،
 *  - `CollectionModule` (تسک ۳.۱۰) از `upsertMany` استفاده کند،
 *  - `AnalysisModule` (تسک ۵.۸) از `getUnanalyzed` استفاده کند.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
