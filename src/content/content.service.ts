import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Post } from '../modules/post/post.entity';
import { NotFoundException } from '../common/exceptions';
import {
  normalizePagination,
  paginate,
  Paginated,
} from '../common/pagination';
import { ContentFeedQuery, HighImpactQuery } from './content.dto';
import {
  ContentItem,
  IMPACT_SQL_EXPRESSION,
  NormalizedContent,
  normalizedToPostFields,
  Timeframe,
  timeframeToSince,
  UpsertResult,
} from './content.types';

/** سقف پیش‌فرض و بیشینهٔ تعداد نتایج high-impact. */
const DEFAULT_HIGH_IMPACT_LIMIT = 10;
const MAX_HIGH_IMPACT_LIMIT = 100;

/**
 * سرویس مدیریت محتوا (ContentModule — design §5.3).
 *
 * «ContentItem» جانشین مفهومی `Post` است و روی همان جدول `posts` نگاشت می‌شود؛
 * از این رو همان موجودیت موجود `Post` تزریق می‌شود (بدون تعریف entity دوم روی
 * جدول `posts` تا تعارض metadata رخ ندهد) — مطابق الگوی `Source = Page` در
 * تسک ۳.۴.
 *
 * این سرویس فید/فیلتر، جزئیات، زمینهٔ دستی، high-impact، محتوای تحلیل‌نشده و
 * upsert idempotent را پیاده می‌کند. هیچ fetch یا فراخوانی LLM در این لایه انجام
 * نمی‌شود؛ `upsertMany` ورودی normalize‌شده را از `CollectionModule` مصرف می‌کند
 * (تسک ۳.۱۰) و خروجی تحلیل توسط `AnalysisModule` نوشته می‌شود (تسک ۵.۸/۵.۹).
 */
@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Post)
    private readonly contentRepository: Repository<Post>,
  ) {}

  /**
   * فید صفحه‌بندی‌شدهٔ محتوا با فیلترهای اختیاری (Requirement 3.1, 12.5-12.7).
   * فیلترها: platform (join به `pages`)، sourceId (`page_id`)، clusterId،
   * contentType، sentimentLabel، جستجوی متنی و بازهٔ زمانی انتشار.
   */
  async findFeed(query: ContentFeedQuery): Promise<Paginated<ContentItem>> {
    const pagination = normalizePagination(query);

    const qb = this.contentRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.page', 'page');

    this.applyFeedFilters(qb, query);

    qb.orderBy('post.published_at', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, pagination);
  }

  /**
   * جزئیات یک ContentItem به‌همراه metadata و metrics (Requirement 3.2).
   * منبع مرتبط (`page`) نیز eager بارگذاری می‌شود؛ در صورت نبود NotFoundException.
   */
  async findById(id: number): Promise<ContentItem> {
    const item = await this.contentRepository.findOne({
      where: { id },
      relations: ['page'],
    });
    if (!item) {
      throw new NotFoundException(`محتوایی با شناسهٔ ${id} یافت نشد`);
    }
    return item;
  }

  /**
   * ثبت زمینهٔ دستی (manual context) یک ContentItem (Requirement 3.3).
   * مقدار خالی به `null` نگاشت می‌شود تا با رفتار legacy `/posts` هم‌خوان بماند.
   */
  async updateContext(
    id: number,
    manualContext: string,
  ): Promise<ContentItem> {
    const item = await this.findById(id);
    item.manual_context = manualContext ? manualContext : null;
    return this.contentRepository.save(item);
  }

  /**
   * درج/به‌روزرسانی idempotent مجموعه‌ای از محتوای normalize‌شده
   * (Requirement 3.5, 4.3). dedupe بر اساس کلید `source_id` (→ `page_id`) +
   * `external_id` انجام می‌شود؛ بنابراین واکشی مجدد همان محتوا رکورد تکراری
   * ایجاد نمی‌کند. آیتم‌های فاقد `external_id` یا `source_id` معتبر skip می‌شوند.
   *
   * خروجی `{ inserted, updated, skipped }` است (design §5.3 — `UpsertResult`).
   */
  async upsertMany(items: NormalizedContent[]): Promise<UpsertResult> {
    const result: UpsertResult = { inserted: 0, updated: 0, skipped: 0 };

    // dedupe درون‌دسته‌ای: آخرین مقدار برای هر کلید برنده است (idempotent).
    const seenInBatch = new Set<string>();

    for (const item of items) {
      const key = this.dedupeKey(item.source_id, item.external_id);
      if (!key) {
        result.skipped += 1;
        continue;
      }

      // اگر همین کلید قبلاً در این batch دیده شده، به‌عنوان تکراری skip می‌شود
      // تا شمارش با تعداد رکوردهای واقعیِ نوشته‌شده هم‌خوان بماند.
      if (seenInBatch.has(key)) {
        result.skipped += 1;
        continue;
      }
      seenInBatch.add(key);

      const existing = await this.contentRepository.findOne({
        where: { page_id: item.source_id, external_id: item.external_id },
      });

      if (existing) {
        Object.assign(existing, normalizedToPostFields(item));
        await this.contentRepository.save(existing);
        result.updated += 1;
      } else {
        const entity = this.contentRepository.create(
          normalizedToPostFields(item),
        );
        await this.contentRepository.save(entity);
        result.inserted += 1;
      }
    }

    return result;
  }

  /**
   * محتوای تحلیل‌نشدهٔ یک منبع در یک بازهٔ زمانی (design §5.3, §4.1 و
   * Requirement 7.2 — مصرف توسط AnalysisService). «تحلیل‌نشده» یعنی فاقد برچسب
   * احساس (`sentiment_label IS NULL`). `now` برای تست‌پذیری قابل تزریق است.
   */
  async getUnanalyzed(
    sourceId: number,
    timeframe: Timeframe,
    now: Date = new Date(),
  ): Promise<ContentItem[]> {
    const qb = this.contentRepository
      .createQueryBuilder('post')
      .where('post.page_id = :sourceId', { sourceId })
      .andWhere('post.sentiment_label IS NULL');

    const since = timeframeToSince(timeframe, now);
    if (since) {
      qb.andWhere('post.published_at >= :since', { since });
    }

    return qb.orderBy('post.published_at', 'DESC').getMany();
  }

  /**
   * محتوای پراثر (high-impact) مرتب‌شده بر اساس معیار اثرگذاری نزولی
   * (Requirement 3.4). معیار: لایک + کامنت + اشتراک + بازدید. فیلترهای اختیاری:
   * منبع، پلتفرم، خوشه و پنجرهٔ زمانی (روز).
   */
  async getHighImpact(
    query: HighImpactQuery,
    now: Date = new Date(),
  ): Promise<ContentItem[]> {
    const limit = this.clampLimit(query.limit);

    const qb = this.contentRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.page', 'page');

    if (query.sourceId !== undefined) {
      qb.andWhere('post.page_id = :sourceId', { sourceId: query.sourceId });
    }
    if (query.platform) {
      qb.andWhere('page.platform = :platform', { platform: query.platform });
    }
    if (query.clusterId !== undefined) {
      qb.andWhere('page.cluster_id = :clusterId', {
        clusterId: query.clusterId,
      });
    }
    if (query.days !== undefined && query.days > 0) {
      const since = new Date(now.getTime() - query.days * 24 * 60 * 60 * 1000);
      qb.andWhere('post.published_at >= :since', { since });
    }

    return qb
      .orderBy(IMPACT_SQL_EXPRESSION, 'DESC')
      .addOrderBy('post.id', 'DESC')
      .limit(limit)
      .getMany();
  }

  /* ------------------------------------------------------------------ */
  /* کمکی‌های داخلی                                                      */
  /* ------------------------------------------------------------------ */

  /** اعمال فیلترهای فید روی query builder. */
  private applyFeedFilters(
    qb: SelectQueryBuilder<Post>,
    query: ContentFeedQuery,
  ): void {
    if (query.sourceId !== undefined) {
      qb.andWhere('post.page_id = :sourceId', { sourceId: query.sourceId });
    }
    if (query.contentType) {
      qb.andWhere('post.post_type = :contentType', {
        contentType: query.contentType,
      });
    }
    if (query.sentimentLabel) {
      qb.andWhere('post.sentiment_label = :sentimentLabel', {
        sentimentLabel: query.sentimentLabel,
      });
    }
    if (query.search) {
      qb.andWhere('post.caption ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.platform) {
      qb.andWhere('page.platform = :platform', { platform: query.platform });
    }
    if (query.clusterId !== undefined) {
      qb.andWhere('page.cluster_id = :clusterId', {
        clusterId: query.clusterId,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('post.published_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }
    if (query.dateTo) {
      qb.andWhere('post.published_at <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }
  }

  /** clamp مقدار limit برای high-impact در بازهٔ `[1, MAX]` با پیش‌فرض. */
  private clampLimit(limit?: number): number {
    if (limit === undefined || !Number.isFinite(limit)) {
      return DEFAULT_HIGH_IMPACT_LIMIT;
    }
    const truncated = Math.trunc(limit);
    if (truncated < 1) return 1;
    if (truncated > MAX_HIGH_IMPACT_LIMIT) return MAX_HIGH_IMPACT_LIMIT;
    return truncated;
  }

  /**
   * ساخت کلید dedupe از `source_id` + `external_id`. اگر هر کدام نامعتبر باشند
   * `null` برمی‌گرداند (آیتم بدون کلید یکتا skip می‌شود).
   */
  private dedupeKey(
    sourceId?: number,
    externalId?: string,
  ): string | null {
    if (
      sourceId === undefined ||
      sourceId === null ||
      !externalId ||
      externalId.trim() === ''
    ) {
      return null;
    }
    return `${sourceId}::${externalId}`;
  }
}
