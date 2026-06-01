import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentModule } from '../content/content.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { CollectionRun } from './entities/collection-run.entity';
import { CollectionService } from './collection.service';
import { InstagramProvider } from './providers/instagram.provider';
import { TelegramProvider } from './providers/telegram.provider';
import { TwitterProvider } from './providers/twitter.provider';
import { InstagramNormalizer } from './normalizers/instagram.normalizer';
import { TelegramNormalizer } from './normalizers/telegram.normalizer';
import { TwitterNormalizer } from './normalizers/twitter.normalizer';

/**
 * CollectionModule — لایهٔ جمع‌آوری داده از پلتفرم‌ها (design §5.5).
 *
 * این ماژول providerها (Instagram/Telegram/Twitter) و normalizerها را فراهم
 * می‌کند و `CollectionService` را برای هماهنگی جریان واکشی → normalize → ذخیره
 * ارائه می‌دهد (Requirement 4.1-4.7).
 *
 * **اتصال به ContentModule (Requirement 4.3/4.4):** برای ذخیرهٔ idempotent از
 * `ContentService.upsertMany` استفاده می‌شود (dedupe بر اساس
 * `source_id + external_id`)؛ بنابراین `ContentModule` import می‌شود و این لایه
 * هرگز مستقیماً در جدول `posts` نمی‌نویسد.
 *
 * **SettingsModule:** برای resolve کلید RapidAPI اینستاگرام (mirror مسیر
 * legacy) import می‌شود.
 *
 * **گذار غیرتخریبی (Requirement 1.6):** در `app.module.ts` به‌صورت dual-import
 * در کنار ماژول‌های legacy ثبت می‌شود؛ مسیرهای legacy fetch (PageService/
 * Telegram/Twitter) دست‌نخورده می‌مانند. `CollectionService` صادر می‌شود تا در
 * تسک ۵.۱۱ به‌عنوان `SourcesCollectionDelegate` و در تسک ۷.۶ در JobWorker wire
 * شود.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CollectionRun]),
    ContentModule,
    SettingsModule,
  ],
  providers: [
    CollectionService,
    InstagramProvider,
    TelegramProvider,
    TwitterProvider,
    InstagramNormalizer,
    TelegramNormalizer,
    TwitterNormalizer,
  ],
  exports: [CollectionService],
})
export class CollectionModule {}
