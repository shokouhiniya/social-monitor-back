import { NormalizedContent } from '../content/content.types';

/**
 * انواع و قراردادهای مشترک CollectionModule (design §5.5 و §11.4).
 *
 * این ماژول تمام منطق fetch از پلتفرم‌ها را — جداشده از Source/Page — کپسوله
 * می‌کند: یک `CollectionProvider` به‌ازای هر پلتفرم، یک `CollectionNormalizer`
 * که خروجی خام را به `NormalizedContent` نگاشت می‌کند، و یک `CollectionService`
 * که جریان `collect` را هماهنگ کرده و نتیجه را در جدول `collection_run` ثبت
 * می‌کند.
 *
 * اصل حاکم (design §2 «دادهٔ معنادار، نه همه‌چیز» و Requirement 4.4): raw payload
 * سنگین ذخیره نمی‌شود؛ تنها `raw_payload_summary` (خلاصهٔ سبک) نگه داشته می‌شود.
 */

/* ------------------------------------------------------------------ */
/* پلتفرم‌ها                                                            */
/* ------------------------------------------------------------------ */

/** پلتفرم‌های پشتیبانی‌شده (design §Glossary — Platform). */
export const COLLECTION_PLATFORMS = [
  'instagram',
  'telegram',
  'twitter',
] as const;
export type Platform = (typeof COLLECTION_PLATFORMS)[number];

/** بررسی اینکه یک مقدار رشته‌ای یک پلتفرم معتبر است. */
export function isPlatform(value: unknown): value is Platform {
  return (
    typeof value === 'string' &&
    (COLLECTION_PLATFORMS as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------------ */
/* ورودی/خروجی خام پلتفرم                                              */
/* ------------------------------------------------------------------ */

/**
 * گزینه‌های واکشی (design §5.5 — `FetchOptions`). همهٔ فیلدها اختیاری‌اند تا
 * provider ها بتوانند مقدار پیش‌فرض منطقی پلتفرم خود را اعمال کنند.
 */
export interface FetchOptions {
  /** بیشینهٔ تعداد آیتم محتوای واکشی‌شده. */
  limit?: number;
  /** تنها محتوای منتشرشده پس از این زمان واکشی شود (در صورت پشتیبانی پلتفرم). */
  since?: Date;
  /** کلیدواژه‌های فیلتر مرتبط‌بودن (برای کانال‌های غیررسمی تلگرام/توییتر). */
  keywords?: string[];
}

/**
 * پروفایل خام بازگشتی از یک پلتفرم (design §5.5 — `RawProfile`). این یک شیء خام
 * و وابسته به پلتفرم است؛ `CollectionNormalizer.normalizeProfile` آن را به
 * `NormalizedProfile` تبدیل می‌کند. هرگز به‌صورت کامل ذخیره نمی‌شود (Req 4.4).
 */
export type RawProfile = Record<string, unknown>;

/**
 * آیتم محتوای خام بازگشتی از یک پلتفرم (design §5.5 — `RawContent`). شیء خام و
 * وابسته به پلتفرم؛ توسط normalizer متناظر به `NormalizedContent` نگاشت می‌شود.
 */
export type RawContent = Record<string, unknown>;

/**
 * پروفایل normalize‌شده (design §5.5 — `NormalizedProfile`). نگاشت به فیلدهای
 * جدول `pages` در لایهٔ Source انجام می‌شود (در این تسک ذخیره نمی‌شود؛ جریان
 * تک‌منبعی در تسک ۵.۱۱ wire می‌گردد).
 */
export interface NormalizedProfile {
  displayName?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  profileImageUrl?: string;
  profileUrl?: string;
}

/* ------------------------------------------------------------------ */
/* واسط‌های provider و normalizer (design §5.5)                          */
/* ------------------------------------------------------------------ */

/**
 * واسط مشترک واکشی هر پلتفرم (design §5.5 — `CollectionProvider`).
 *
 * **قرارداد خطا (Requirement 4.6 / design §11.4):** متدهای provider در مواجهه با
 * خطای پلتفرم (rate-limit، پروفایل خصوصی/نامعتبر، timeout شبکه) باید یک
 * `CollectionProviderError` با `reason` طبقه‌بندی‌شده پرتاب کنند، نه یک استثنای
 * خام. `CollectionService.collect` این خطا را گرفته و در `CollectionRunSummary`
 * با شمارش و دلیل بازتاب می‌دهد و هرگز اجازهٔ نشت استثنای کنترل‌نشده را نمی‌دهد.
 */
export interface CollectionProvider {
  /** پلتفرمی که این provider پوشش می‌دهد. */
  readonly platform: Platform;
  /** واکشی پروفایل خام یک username. */
  fetchProfile(username: string): Promise<RawProfile>;
  /** واکشی محتوای خام یک username با گزینه‌های دلخواه. */
  fetchPosts(username: string, opts?: FetchOptions): Promise<RawContent[]>;
}

/**
 * واسط نگاشت خروجی خام به ساختارهای normalize‌شده (design §5.5 —
 * `CollectionNormalizer`). normalizer باید در برابر دادهٔ ناقص مقاوم باشد:
 * آیتم‌های فاقد فیلد ضروری را کنار بگذارد (نه crash) تا شمارش skip در سرویس
 * دقیق بماند (Requirement 4.7).
 */
export interface CollectionNormalizer {
  /** پلتفرمی که این normalizer پوشش می‌دهد. */
  readonly platform: Platform;
  /** نگاشت پروفایل خام به `NormalizedProfile`. */
  normalizeProfile(raw: RawProfile): NormalizedProfile;
  /**
   * نگاشت آرایهٔ محتوای خام به `NormalizedContent`. مقدار `sourceId` برای پرکردن
   * `source_id` (→ ستون `page_id`) لازم است. آیتم‌های فاقد `external_id` معتبر
   * باید کنار گذاشته شوند.
   */
  normalizeContent(
    raw: RawContent[],
    sourceId: number,
  ): NormalizedContent[];
}

/* ------------------------------------------------------------------ */
/* خلاصهٔ اجرای واکشی (design §5.5 / §11.4)                              */
/* ------------------------------------------------------------------ */

/**
 * خلاصهٔ یک اجرای واکشی (Requirement 4.5/4.6/4.7).
 *
 * شکل این نوع عمداً با `CollectionRunSummary` در
 * `sources/sources.delegation.ts` ساختاری یکسان است تا در تسک ۵.۱۱ بتوان
 * `CollectionService` را بدون آداپتور به‌عنوان `SourcesCollectionDelegate` wire
 * کرد (سازگاری ساختاری TypeScript).
 *
 * - `fetched`: تعداد آیتم خام واکشی‌شده از provider.
 * - `created`: تعداد رکوردهای تازه درج‌شده (از `ContentService.upsertMany`).
 * - `updated`: تعداد رکوردهای به‌روزرسانی‌شده.
 * - `skipped`: مجموع آیتم‌های ردشده (فاقد فیلد ضروری + تکراری درون‌دسته).
 * - `errors`: تعداد خطاهای provider که در این اجرا رخ داده‌اند.
 * - `errorReasons`: دلایل خطا (طبقه‌بندی‌شده) برای نمایش به کاربر.
 */
export interface CollectionRunSummary {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorReasons?: string[];
}

/** وضعیت نهایی یک اجرای واکشی برای ثبت در `collection_run`. */
export const COLLECTION_RUN_STATUSES = [
  'success',
  'partial',
  'failed',
] as const;
export type CollectionRunStatus = (typeof COLLECTION_RUN_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* خطای provider طبقه‌بندی‌شده (Requirement 4.6 / design §11.4)          */
/* ------------------------------------------------------------------ */

/** دلایل طبقه‌بندی‌شدهٔ خطای پلتفرم. */
export const COLLECTION_ERROR_REASONS = [
  'rate_limit',
  'private_or_invalid',
  'timeout',
  'provider_error',
] as const;
export type CollectionErrorReason = (typeof COLLECTION_ERROR_REASONS)[number];

/**
 * خطای طبقه‌بندی‌شدهٔ provider. provider ها این خطا را به‌جای استثنای خام پرتاب
 * می‌کنند تا `CollectionService` بتواند آن را به `CollectionRunSummary` نگاشت
 * کند (Requirement 4.6). این یک خطای کنترل‌شدهٔ داخلی است و نباید به فیلتر خطای
 * سراسری برسد؛ سرویس آن را می‌گیرد و بازتاب می‌دهد.
 */
export class CollectionProviderError extends Error {
  readonly reason: CollectionErrorReason;
  /** کد وضعیت HTTP خام (در صورت وجود) برای اشکال‌زدایی. */
  readonly statusCode?: number;

  constructor(
    reason: CollectionErrorReason,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = 'CollectionProviderError';
    this.reason = reason;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, CollectionProviderError.prototype);
  }
}

/**
 * طبقه‌بندی یک خطای خام (معمولاً خطای axios یا شبکه) به یک
 * `CollectionProviderError`. این تابع خالص و قابل‌تست است:
 *  - کد ۴۲۹ یا پیام rate-limit → `rate_limit`
 *  - کد ۴۰۱/۴۰۳/۴۰۴/۴۵۱ یا پیام private/not found → `private_or_invalid`
 *  - timeout/ECONNABORTED/ETIMEDOUT → `timeout`
 *  - سایر موارد → `provider_error`
 */
export function classifyProviderError(
  error: unknown,
  platform: Platform,
): CollectionProviderError {
  if (error instanceof CollectionProviderError) {
    return error;
  }

  const err = (error ?? {}) as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  const statusCode = err.response?.status;
  const rawMessage =
    err.response?.data?.message || err.message || 'خطای ناشناختهٔ provider';
  const lower = String(rawMessage).toLowerCase();
  const code = String(err.code || '').toUpperCase();

  let reason: CollectionErrorReason;
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    lower.includes('timeout')
  ) {
    reason = 'timeout';
  } else if (statusCode === 429 || lower.includes('rate limit')) {
    reason = 'rate_limit';
  } else if (
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 404 ||
    statusCode === 451 ||
    lower.includes('private') ||
    lower.includes('not found')
  ) {
    reason = 'private_or_invalid';
  } else {
    reason = 'provider_error';
  }

  const reasonText: Record<CollectionErrorReason, string> = {
    rate_limit: 'محدودیت نرخ (rate-limit) پلتفرم',
    private_or_invalid: 'پروفایل خصوصی یا نامعتبر',
    timeout: 'timeout شبکه',
    provider_error: 'خطای provider/شبکه',
  };

  return new CollectionProviderError(
    reason,
    `[${platform}] ${reasonText[reason]}: ${rawMessage}`,
    statusCode,
  );
}

/* ------------------------------------------------------------------ */
/* خلاصهٔ سبک raw payload (Requirement 4.4)                              */
/* ------------------------------------------------------------------ */

/** سقف نمونه‌های external_id ذخیره‌شده در خلاصه (برای سبک‌ماندن). */
export const RAW_SUMMARY_SAMPLE_SIZE = 10;

/**
 * خلاصهٔ سبک یک اجرای واکشی (Requirement 4.4). به‌جای raw payload سنگین فقط
 * متادیتای جمع‌بندی ذخیره می‌شود: وجود پروفایل، شمارش‌ها، توزیع نوع محتوا و
 * نمونه‌ای کوچک از external_id ها.
 */
export interface RawPayloadSummary {
  platform: Platform;
  username?: string;
  profile: {
    present: boolean;
    followersCount?: number;
    followingCount?: number;
  };
  content: {
    fetchedCount: number;
    /** توزیع نوع محتوا (image/video/reel/...). */
    typeCounts: Record<string, number>;
    /** نمونهٔ کوچک از external_id ها (حداکثر `RAW_SUMMARY_SAMPLE_SIZE`). */
    sampleExternalIds: string[];
  };
}

/**
 * ساخت `RawPayloadSummary` از خروجی normalize‌شده (تابع خالص و قابل‌تست).
 * عمداً تنها دادهٔ سبک نگه می‌دارد و هیچ payload خامی را کپی نمی‌کند (Req 4.4).
 */
export function buildRawPayloadSummary(params: {
  platform: Platform;
  username?: string;
  profile: NormalizedProfile | null;
  content: NormalizedContent[];
}): RawPayloadSummary {
  const typeCounts: Record<string, number> = {};
  const sampleExternalIds: string[] = [];

  for (const item of params.content) {
    const type = item.content_type ?? 'unknown';
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    if (
      sampleExternalIds.length < RAW_SUMMARY_SAMPLE_SIZE &&
      item.external_id
    ) {
      sampleExternalIds.push(item.external_id);
    }
  }

  return {
    platform: params.platform,
    username: params.username,
    profile: {
      present: params.profile !== null,
      followersCount: params.profile?.followersCount,
      followingCount: params.profile?.followingCount,
    },
    content: {
      fetchedCount: params.content.length,
      typeCounts,
      sampleExternalIds,
    },
  };
}

/**
 * فیلدهای ضروری یک `NormalizedContent` برای پایداری (Requirement 4.7). تنها
 * `external_id` غیرتهی الزامی است؛ `source_id` توسط سرویس از روی Source تنظیم
 * می‌شود. آیتم فاقد این فیلد skip و شمارش می‌شود.
 */
export function hasRequiredContentFields(item: NormalizedContent): boolean {
  return (
    typeof item.external_id === 'string' &&
    item.external_id.trim() !== '' &&
    typeof item.source_id === 'number' &&
    Number.isFinite(item.source_id)
  );
}
