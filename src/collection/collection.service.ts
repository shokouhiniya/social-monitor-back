import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentService } from '../content/content.service';
import { NormalizedContent } from '../content/content.types';
import { Source } from '../sources/source.types';
import { CollectionRun } from './entities/collection-run.entity';
import {
  InstagramNormalizer,
} from './normalizers/instagram.normalizer';
import { TelegramNormalizer } from './normalizers/telegram.normalizer';
import { TwitterNormalizer } from './normalizers/twitter.normalizer';
import { InstagramProvider } from './providers/instagram.provider';
import { TelegramProvider } from './providers/telegram.provider';
import { TwitterProvider } from './providers/twitter.provider';
import {
  buildRawPayloadSummary,
  classifyProviderError,
  CollectionNormalizer,
  CollectionProvider,
  CollectionProviderError,
  CollectionRunStatus,
  CollectionRunSummary,
  FetchOptions,
  hasRequiredContentFields,
  isPlatform,
  NormalizedProfile,
  Platform,
  RawProfile,
} from './collection.types';
import { NotFoundException, ValidationException } from '../common/exceptions';

/**
 * سرویس جمع‌آوری داده (CollectionModule — design §5.5 و §11.4).
 *
 * مسئولیت‌ها:
 *  - `getProvider(platform)`: ارائهٔ `CollectionProvider` متناظر هر پلتفرم
 *    (Requirement 4.1).
 *  - `collect(source, opts?)`: هماهنگی جریان واکشی → normalize → dedupe/ذخیره →
 *    ثبت `collection_run` و بازگرداندن `CollectionRunSummary`.
 *
 * اصول کلیدی این تسک:
 *  - **dedupe idempotent (Requirement 4.3):** ذخیره از طریق
 *    `ContentService.upsertMany` انجام می‌شود که بر اساس `source_id + external_id`
 *    حذف تکراری می‌کند؛ این لایه هرگز مستقیماً در جدول `posts` نمی‌نویسد.
 *  - **فقط دادهٔ معنادار (Requirement 4.4):** به‌جای raw payload سنگین تنها
 *    `raw_payload_summary` سبک ذخیره می‌شود.
 *  - **بازتاب خطا، نه پرتاب (Requirement 4.6):** خطاهای provider (rate-limit/
 *    خصوصی/timeout) گرفته شده و در `CollectionRunSummary` با شمارش و دلیل بازتاب
 *    می‌شوند؛ `collect` برای خطای پلتفرم استثنای کنترل‌نشده پرتاب نمی‌کند.
 *  - **skip آیتم ناقص (Requirement 4.7):** آیتم فاقد فیلد ضروری skip و شمارش
 *    می‌شود و اجرا ادامه می‌یابد.
 *
 * شکل خروجی `CollectionRunSummary` عمداً با همتای آن در
 * `sources/sources.delegation.ts` یکسان است تا در تسک ۵.۱۱ این سرویس بدون
 * آداپتور به‌عنوان `SourcesCollectionDelegate` wire شود.
 */
@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  private readonly providers: Map<Platform, CollectionProvider>;
  private readonly normalizers: Map<Platform, CollectionNormalizer>;

  constructor(
    @InjectRepository(CollectionRun)
    private readonly collectionRunRepository: Repository<CollectionRun>,
    private readonly contentService: ContentService,
    instagramProvider: InstagramProvider,
    telegramProvider: TelegramProvider,
    twitterProvider: TwitterProvider,
    instagramNormalizer: InstagramNormalizer,
    telegramNormalizer: TelegramNormalizer,
    twitterNormalizer: TwitterNormalizer,
  ) {
    this.providers = new Map<Platform, CollectionProvider>([
      ['instagram', instagramProvider],
      ['telegram', telegramProvider],
      ['twitter', twitterProvider],
    ]);
    this.normalizers = new Map<Platform, CollectionNormalizer>([
      ['instagram', instagramNormalizer],
      ['telegram', telegramNormalizer],
      ['twitter', twitterNormalizer],
    ]);
  }

  /**
   * بازگرداندن provider متناظر یک پلتفرم (design §5.5 — `getProvider`). برای
   * پلتفرم نامعتبر یک `ValidationException` پرتاب می‌شود.
   */
  getProvider(platform: Platform): CollectionProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new ValidationException(`پلتفرم پشتیبانی‌نشده: ${platform}`);
    }
    return provider;
  }

  /**
   * اجرای یک واکشی برای یک منبع و ثبت `collection_run` (Requirement 4.2-4.7).
   *
   * این متد برای خطاهای پلتفرم استثنا پرتاب نمی‌کند؛ آن‌ها را در summary بازتاب
   * می‌دهد. تنها خطاهای ساختاری ورودی (منبع نامعتبر/بدون username) به‌صورت
   * `DomainException` پرتاب می‌شوند تا فیلتر سراسری envelope مناسب بسازد.
   */
  async collect(
    source: Source,
    opts?: FetchOptions,
  ): Promise<CollectionRunSummary> {
    if (!source) {
      throw new NotFoundException('منبع برای واکشی یافت نشد');
    }
    const platform = source.platform;
    if (!isPlatform(platform)) {
      throw new ValidationException(
        `پلتفرم منبع نامعتبر یا پشتیبانی‌نشده است: ${platform}`,
      );
    }
    if (!source.username) {
      throw new ValidationException('username منبع برای واکشی الزامی است');
    }

    const provider = this.getProvider(platform);
    const normalizer = this.normalizers.get(platform)!;
    const startedAt = new Date();

    const summary: CollectionRunSummary = {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorReasons: [],
    };

    let profile: NormalizedProfile | null = null;
    let normalizedContent: NormalizedContent[] = [];

    // ۱) واکشی پروفایل (اختیاری — نبود آن اجرا را متوقف نمی‌کند).
    try {
      const rawProfile: RawProfile = await provider.fetchProfile(
        source.username,
      );
      profile = normalizer.normalizeProfile(rawProfile);
    } catch (error) {
      this.recordError(summary, error, platform);
    }

    // ۲) واکشی محتوا.
    try {
      const rawContent = await provider.fetchPosts(source.username, opts);
      summary.fetched = Array.isArray(rawContent) ? rawContent.length : 0;

      // ۳) normalize — مقاوم در برابر دادهٔ ناقص.
      const normalizedAll = normalizer.normalizeContent(rawContent, source.id);

      // ۴) skip آیتم‌های فاقد فیلد ضروری (Requirement 4.7). تفاضل بین آیتم‌های
      //    واکشی‌شده و آیتم‌های معتبرِ normalize‌شده به‌عنوان skip شمرده می‌شود.
      normalizedContent = normalizedAll.filter(hasRequiredContentFields);
      const droppedByNormalizer = summary.fetched - normalizedAll.length;
      const droppedByValidation =
        normalizedAll.length - normalizedContent.length;
      summary.skipped +=
        Math.max(0, droppedByNormalizer) + droppedByValidation;
    } catch (error) {
      this.recordError(summary, error, platform);
    }

    // ۵) ذخیرهٔ idempotent از طریق ContentService.upsertMany (dedupe بر اساس
    //    source_id + external_id — Requirement 4.3). هرگز مستقیم در posts نمی‌نویسیم.
    if (normalizedContent.length > 0) {
      try {
        const result = await this.contentService.upsertMany(normalizedContent);
        summary.created += result.inserted;
        summary.updated += result.updated;
        summary.skipped += result.skipped;
      } catch (error) {
        // خطای ذخیره‌سازی نیز کنترل‌شده بازتاب می‌شود تا اجرا crash نکند.
        this.recordError(summary, error, platform);
      }
    }

    // ۶) ثبت رکورد collection_run با شمارش‌ها و خلاصهٔ سبک payload.
    const status = this.deriveStatus(summary);
    await this.persistRun({
      source,
      platform,
      status,
      summary,
      profile,
      content: normalizedContent,
      startedAt,
      finishedAt: new Date(),
    });

    // پاکسازی آرایهٔ خالی دلایل برای خروجی تمیزتر.
    if (summary.errorReasons && summary.errorReasons.length === 0) {
      delete summary.errorReasons;
    }
    return summary;
  }

  /* ---------------------------------------------------------------- */
  /* کمکی‌های داخلی                                                    */
  /* ---------------------------------------------------------------- */

  /** نگاشت یک خطای گرفته‌شده به شمارش/دلیل در summary (Requirement 4.6). */
  private recordError(
    summary: CollectionRunSummary,
    error: unknown,
    platform: Platform,
  ): void {
    const classified: CollectionProviderError =
      error instanceof CollectionProviderError
        ? error
        : classifyProviderError(error, platform);
    summary.errors += 1;
    summary.errorReasons = summary.errorReasons ?? [];
    summary.errorReasons.push(classified.message);
    this.logger.warn(
      `خطای واکشی [${platform}] (${classified.reason}): ${classified.message}`,
    );
  }

  /** تعیین وضعیت نهایی اجرا بر اساس شمارش‌ها. */
  private deriveStatus(summary: CollectionRunSummary): CollectionRunStatus {
    if (summary.errors === 0) return 'success';
    // اگر خطا داشتیم ولی محتوایی هم ذخیره/واکشی شد → partial؛ وگرنه failed.
    if (summary.created > 0 || summary.updated > 0 || summary.fetched > 0) {
      return 'partial';
    }
    return 'failed';
  }

  /** ثبت رکورد `collection_run` (Requirement 4.5). */
  private async persistRun(params: {
    source: Source;
    platform: Platform;
    status: CollectionRunStatus;
    summary: CollectionRunSummary;
    profile: NormalizedProfile | null;
    content: NormalizedContent[];
    startedAt: Date;
    finishedAt: Date;
  }): Promise<CollectionRun> {
    const { summary } = params;
    const run = this.collectionRunRepository.create({
      source_id: params.source.id,
      platform: params.platform,
      status: params.status,
      fetched_count: summary.fetched,
      new_count: summary.created,
      updated_count: summary.updated,
      error_count: summary.errors,
      skipped_count: summary.skipped,
      error_message:
        summary.errorReasons && summary.errorReasons.length > 0
          ? summary.errorReasons.join(' | ')
          : null,
      raw_payload_summary: buildRawPayloadSummary({
        platform: params.platform,
        username: params.source.username,
        profile: params.profile,
        content: params.content,
      }),
      started_at: params.startedAt,
      finished_at: params.finishedAt,
    });
    return this.collectionRunRepository.save(run);
  }
}
