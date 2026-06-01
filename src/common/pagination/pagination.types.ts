/**
 * انواع و ثابت‌های مشترک صفحه‌بندی (Pagination).
 *
 * قرارداد صفحه‌بندی مطابق Requirement 12.5-12.7:
 *  - پارامترهای `page` و `pageSize` با پیش‌فرض `pageSize = 20`.
 *  - مقدار `pageSize` در بازهٔ `[1, 100]` clamp می‌شود.
 *  - خروجی همیشه به شکل `{ items, total, page, pageSize }` است.
 */

/** کمترین مقدار مجاز برای `pageSize`. */
export const MIN_PAGE_SIZE = 1;

/** بیشترین مقدار مجاز برای `pageSize` (سقف). */
export const MAX_PAGE_SIZE = 100;

/** مقدار پیش‌فرض `pageSize` در صورت ارائه‌نشدن. */
export const DEFAULT_PAGE_SIZE = 20;

/** کمترین مقدار مجاز برای `page`. */
export const MIN_PAGE = 1;

/** مقدار پیش‌فرض `page` در صورت ارائه‌نشدن. */
export const DEFAULT_PAGE = 1;

/**
 * ورودی خام صفحه‌بندی همان‌گونه که از query string می‌رسد
 * (مقادیر می‌توانند string، number، undefined یا null باشند).
 */
export interface PaginationInput {
  page?: number | string | null;
  pageSize?: number | string | null;
}

/**
 * خروجی نرمال‌شدهٔ صفحه‌بندی پس از اعمال clamp/پیش‌فرض.
 * `skip`/`take` برای استفادهٔ مستقیم در query های TypeORM فراهم شده‌اند.
 */
export interface NormalizedPagination {
  /** شمارهٔ صفحهٔ مؤثر (همیشه `>= 1`). */
  page: number;
  /** اندازهٔ صفحهٔ مؤثر (همیشه `1 <= pageSize <= 100`). */
  pageSize: number;
  /** تعداد رکوردهایی که باید رد شوند: `(page - 1) * pageSize`. */
  skip: number;
  /** تعداد رکوردهایی که باید برداشته شوند: برابر `pageSize`. */
  take: number;
}

/**
 * شکل استاندارد پاسخ صفحه‌بندی‌شده که در فیلد `data` envelope قرار می‌گیرد.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
