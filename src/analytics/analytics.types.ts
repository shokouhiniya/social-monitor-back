/**
 * انواع مشترک AnalyticsModule (design §5.9، Requirement 8).
 *
 * این لایه **فقط تجمیع read-only** است: هیچ fetch یا فراخوانی LLM ندارد و به
 * `SourcesService` وابسته نیست (بدون وابستگی circular — design §3.2). تمام
 * داشبوردها از جدول‌های summary روزانهٔ `*_daily_metrics` خوانده می‌شوند، نه از
 * query خام سنگین روی دادهٔ خام (Requirement 15.3).
 */

/**
 * فیلتر دامنهٔ تحلیل (design §5.9 — `ScopeFilter`). یک داشبورد می‌تواند برای کل
 * سیستم (هیچ‌کدام تعیین نشده)، یک شبکه (`networkId`) یا یک cluster (`clusterId`)
 * درخواست شود. وقتی هیچ‌کدام تعیین نشوند، دامنه «سراسری» است.
 */
export interface ScopeFilter {
  /** محدودسازی به یک شبکهٔ عملیاتی خاص (network_id). */
  networkId?: number;
  /** محدودسازی به یک cluster خاص (cluster_id). */
  clusterId?: number;
}

/**
 * بازهٔ زمانی تاریخ‌محور برای خط‌زمانی‌ها (design §5.9 — `DateRange`). مرزها
 * شامل (inclusive) هستند و به‌صورت رشتهٔ `YYYY-MM-DD` (هم‌خوان با ستون `date`)
 * نگه داشته می‌شوند.
 */
export interface DateRange {
  /** تاریخ شروع (شامل) به‌صورت `YYYY-MM-DD`. */
  from: string;
  /** تاریخ پایان (شامل) به‌صورت `YYYY-MM-DD`. */
  to: string;
}

/**
 * خروجی داشبورد ماکرو (design §5.9 — `MacroDashboard`، Requirement 8.2). تجمیع
 * شده از جدول‌های summary روزانه برای آخرین روز موجود در دامنهٔ درخواست‌شده.
 */
export interface MacroDashboard {
  /** دامنه‌ای که این داشبورد برای آن محاسبه شده. */
  scope: ScopeFilter;
  /** آخرین روزی که داده برای آن وجود دارد (`YYYY-MM-DD`) یا null اگر داده‌ای نباشد. */
  date: string | null;
  /** تعداد منبع فعال در دامنه. */
  activeSources: number;
  /** تعداد کل محتوای جدید در دامنه برای آن روز. */
  newContent: number;
  /** میانگین احساس وزن‌دار دامنه (بین -1 و 1) یا null اگر داده‌ای نباشد. */
  avgSentiment: number | null;
  /** شمار هشدارهای فعال در دامنه برای آن روز. */
  alertCount: number;
}

/**
 * یک نقطه روی خط‌زمانی احساسات (design §5.9 — `TimelinePoint`، Requirement 8.3).
 */
export interface TimelinePoint {
  /** روز نقطه (`YYYY-MM-DD`). */
  date: string;
  /** میانگین احساس آن روز (بین -1 و 1) یا null اگر داده‌ای نباشد. */
  avgSentiment: number | null;
  /** تعداد محتوای جدید آن روز (مبنای وزن‌دهی). */
  newContent: number;
}

/**
 * سرعت رشد یک کلیدواژه (design §5.9 — `KeywordVelocity`، Requirement 8.4).
 */
export interface KeywordVelocity {
  /** خود کلیدواژه. */
  keyword: string;
  /** آخرین روزی که برای کلیدواژه داده وجود دارد (`YYYY-MM-DD`). */
  date: string;
  /** شمار رخداد در آن روز. */
  count: number;
  /** سرعت رشد نسبت به روز قبل (می‌تواند منفی باشد) یا null. */
  velocity: number | null;
}

/**
 * نبض یک شبکه (design §5.9 — `NetworkPulse`، Requirement 8.5). آخرین وضعیت
 * تجمیعی شبکه به‌علاوهٔ یک خط‌زمانی کوتاه احساس.
 */
export interface NetworkPulse {
  /** شناسهٔ شبکه. */
  networkId: number;
  /** آخرین روزی که داده وجود دارد (`YYYY-MM-DD`) یا null. */
  date: string | null;
  /** تعداد منبع فعال در آخرین روز. */
  activeSources: number;
  /** تعداد محتوای جدید در آخرین روز. */
  newContent: number;
  /** میانگین احساس آخرین روز یا null. */
  avgSentiment: number | null;
  /** شمار هشدار آخرین روز. */
  alertCount: number;
  /** خط‌زمانی کوتاه احساس (به ترتیب صعودی تاریخ). */
  timeline: TimelinePoint[];
}
