import { Post } from '../modules/post/post.entity';

/**
 * انواع و ثابت‌های مشترک ContentModule (design §5.3).
 *
 * مفهوم «ContentItem» (واحد محتوا: پست، استوری، ریلز، پیام تلگرام، توییت)
 * جانشین مفهومی `Post` است و دقیقاً روی همان جدول `posts` نگاشت می‌شود. برای
 * جلوگیری از تعارض metadata در TypeORM (دو کلاس روی یک جدول)، به‌جای تعریف یک
 * entity جدید، همان موجودیت موجود `Post` دوباره استفاده می‌شود و در این لایه با
 * نام مفهومی `ContentItem` در دسترس قرار می‌گیرد — دقیقاً مطابق الگوی
 * `Source = Page` در `SourcesModule` (تسک ۳.۴).
 */
export type ContentItem = Post;

/**
 * پلتفرم‌های پشتیبانی‌شدهٔ محتوا (design §Glossary — Platform). فیلتر `platform`
 * در فید از طریق join به جدول `pages` اعمال می‌شود (Requirement 3.1).
 */
export const CONTENT_PLATFORMS = ['instagram', 'telegram', 'twitter'] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

/**
 * بازهٔ زمانی محتوا (design §5.2/§5.3 — `getUnanalyzed(sourceId, timeframe)`).
 * مقادیر مجاز با `SOURCE_TIMEFRAMES` در SourcesModule هم‌خوان نگه داشته شده‌اند.
 */
export const CONTENT_TIMEFRAMES = ['24h', '7d', '30d', '90d', 'all'] as const;
export type Timeframe = (typeof CONTENT_TIMEFRAMES)[number];

/**
 * شکل ورودی `upsertMany` (design §5.3, §5.5, §6.2 و Requirement 3.5/4.2/4.3).
 *
 * این ساختار خروجی normalize‌شدهٔ `CollectionModule` است و به ستون‌های فیزیکی
 * جدول `posts` نگاشت می‌شود. کلید idempotency برای dedupe ترکیب
 * `source_id` (→ `page_id`) و `external_id` است (Requirement 4.3).
 *
 * نگاشت مفهومی (design §6.2):
 *  - `source_id`   → ستون `page_id`
 *  - `external_id` → ستون `external_id`
 *  - `url`/`shortcode` → ستون `shortcode` (مبنای اشتقاق URL)
 *  - `content_type`→ ستون `post_type`
 *  - `metrics.*`   → ستون‌های `likes_count`/`comments_count`/`shares_count`/`views_count`
 *  - `media_url`   → ستون `media_url`
 */
export interface NormalizedContent {
  /** شناسهٔ منبع — به ستون `page_id` نگاشت می‌شود. */
  source_id: number;
  /** شناسهٔ یکتای پلتفرمی — بخشی از کلید dedupe (Requirement 4.3). */
  external_id: string;
  /** URL کامل محتوا (در صورت وجود) — مبنای اشتقاق `shortcode`. */
  url?: string;
  /** shortcode پلتفرم (مثلاً اینستاگرام) — به ستون `shortcode` نگاشت می‌شود. */
  shortcode?: string;
  /** نوع محتوا (image/video/reel/story/carousel) — به `post_type` نگاشت. */
  content_type?: string;
  /** متن/کپشن محتوا. */
  caption?: string;
  /** ترجمهٔ فارسی کپشن (در صورت غیرفارسی بودن). */
  caption_fa?: string;
  /** نشانی رسانه. */
  media_url?: string;
  /** متریک‌های تعامل. */
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  /** آیا محتوا مرتبط است (برای کانال‌های فیلترشده). */
  is_relevant?: boolean;
  /** زمان انتشار. */
  published_at?: Date | string;
}

/**
 * نتیجهٔ `upsertMany` (design §5.3 — `UpsertResult`). شمارش رکوردهای درج‌شدهٔ
 * جدید، به‌روزرسانی‌شده و رد‌شده (فاقد کلید معتبر) را برمی‌گرداند.
 */
export interface UpsertResult {
  /** تعداد رکوردهای تازه درج‌شده. */
  inserted: number;
  /** تعداد رکوردهای موجود که به‌روزرسانی شدند. */
  updated: number;
  /** تعداد آیتم‌های ردشده (فاقد `external_id`/`source_id` معتبر). */
  skipped: number;
}

/**
 * نگاشت یک `NormalizedContent` به فیلدهای فیزیکی موجودیت `Post`. تنها فیلدهای
 * ارائه‌شده اعمال می‌شوند تا در upsert مقادیر موجود بی‌جهت بازنویسی نشوند.
 */
export function normalizedToPostFields(item: NormalizedContent): Partial<Post> {
  const fields: Partial<Post> = {
    page_id: item.source_id,
    external_id: item.external_id,
  };

  // shortcode از `shortcode` صریح یا انتهای `url` مشتق می‌شود.
  const shortcode = item.shortcode ?? deriveShortcode(item.url);
  if (shortcode !== undefined) fields.shortcode = shortcode;

  if (item.content_type !== undefined) fields.post_type = item.content_type;
  if (item.caption !== undefined) fields.caption = item.caption;
  if (item.caption_fa !== undefined) fields.caption_fa = item.caption_fa;
  if (item.media_url !== undefined) fields.media_url = item.media_url;
  if (item.is_relevant !== undefined) fields.is_relevant = item.is_relevant;

  if (item.published_at !== undefined) {
    fields.published_at =
      item.published_at instanceof Date
        ? item.published_at
        : new Date(item.published_at);
  }

  if (item.metrics) {
    if (item.metrics.likes !== undefined) fields.likes_count = item.metrics.likes;
    if (item.metrics.comments !== undefined)
      fields.comments_count = item.metrics.comments;
    if (item.metrics.shares !== undefined)
      fields.shares_count = item.metrics.shares;
    if (item.metrics.views !== undefined) fields.views_count = item.metrics.views;
  }

  return fields;
}

/**
 * اشتقاق `shortcode` از یک URL کامل (آخرین بخش مسیر). اگر URL ارائه نشده باشد
 * `undefined` برمی‌گرداند.
 */
function deriveShortcode(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.replace(/\/+$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

/**
 * محاسبهٔ معیار اثرگذاری (impact) یک ContentItem (design §5.3 — high-impact).
 * مجموع تعامل‌ها: لایک + کامنت + اشتراک‌گذاری + بازدید. این تابع خالص برای مرتب‌سازی
 * و تست‌پذیری مستقیم استخراج شده است.
 */
export function impactScore(item: Pick<
  Post,
  'likes_count' | 'comments_count' | 'shares_count' | 'views_count'
>): number {
  return (
    (item.likes_count ?? 0) +
    (item.comments_count ?? 0) +
    (item.shares_count ?? 0) +
    (item.views_count ?? 0)
  );
}

/** عبارت SQL معیار اثرگذاری برای مرتب‌سازی سمت دیتابیس (alias: `post`). */
export const IMPACT_SQL_EXPRESSION =
  '(post.likes_count + post.comments_count + post.shares_count + post.views_count)';

/**
 * تبدیل یک `Timeframe` به تاریخ شروع (since). مقدار `all` به `null` نگاشت می‌شود
 * (بدون محدودیت زمانی). `now` برای تست‌پذیری قابل تزریق است.
 */
export function timeframeToSince(
  timeframe: Timeframe,
  now: Date = new Date(),
): Date | null {
  const ms: Record<Exclude<Timeframe, 'all'>, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  if (timeframe === 'all') return null;
  return new Date(now.getTime() - ms[timeframe]);
}
