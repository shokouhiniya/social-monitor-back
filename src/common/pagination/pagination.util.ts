import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE,
  MIN_PAGE_SIZE,
  NormalizedPagination,
  Paginated,
  PaginationInput,
} from './pagination.types';

/**
 * یک مقدار خام (string|number|null|undefined) را به عددِ صحیحِ معتبر تبدیل می‌کند.
 * در صورت نامعتبر بودن (NaN، خالی، اعشاری نامفهوم) مقدار `fallback` برگردانده می‌شود.
 */
function toInt(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

/**
 * یک عدد را در بازهٔ بستهٔ `[min, max]` clamp می‌کند.
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * ورودی خام صفحه‌بندی را به مقادیر مؤثر نرمال می‌کند.
 *
 * تضمین‌ها (Requirement 12.6):
 *  - `1 <= pageSize <= 100`؛ مقدار کمتر از ۱ به ۱ و بیشتر از ۱۰۰ به ۱۰۰ clamp می‌شود.
 *  - در صورت ارائه‌نشدن `pageSize`، مقدار پیش‌فرض ۲۰ استفاده می‌شود.
 *  - `page >= 1`؛ مقدار کمتر از ۱ به ۱ clamp می‌شود (پیش‌فرض ۱).
 *  - `skip = (page - 1) * pageSize` و `take = pageSize`.
 */
export function normalizePagination(
  input: PaginationInput = {},
): NormalizedPagination {
  const page = Math.max(MIN_PAGE, toInt(input.page, DEFAULT_PAGE));
  const pageSize = clamp(
    toInt(input.pageSize, DEFAULT_PAGE_SIZE),
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * یک مجموعهٔ از پیش برش‌خوردهٔ `items` را همراه با `total` در قالب استاندارد
 * صفحه‌بندی `{ items, total, page, pageSize }` بسته‌بندی می‌کند.
 *
 * این تابع مقادیر مؤثر `page`/`pageSize` را echo می‌کند و فرض می‌کند که
 * `items` پیش‌تر (مثلاً توسط query دیتابیس با `skip`/`take`) به اندازهٔ یک صفحه
 * محدود شده است. برای جلوگیری از نقض ناوردا‌ها، در صورت بزرگ‌تر بودن طول `items`
 * از `pageSize`، آرایه به `pageSize` برش زده می‌شود.
 *
 * تضمین‌ها (Requirement 12.7):
 *  - `items.length <= effectivePageSize`.
 *  - `total >= items.length` و `total >= 0`.
 *  - `page`/`pageSize` بازتاب‌شده با مقادیر مؤثر سازگارند.
 */
export function paginate<T>(
  items: T[],
  total: number,
  pagination: NormalizedPagination,
): Paginated<T> {
  const safeItems = items.slice(0, pagination.pageSize);
  const normalizedTotal = Math.max(
    Math.max(0, Math.trunc(total)),
    safeItems.length,
  );

  return {
    items: safeItems,
    total: normalizedTotal,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

/**
 * نسخهٔ راحت `paginate` برای حالتی که یک مجموعهٔ کاملِ درون‌حافظه‌ای داریم و
 * می‌خواهیم صفحهٔ مربوطه را خودمان برش بزنیم (مفید برای تست و داده‌های کوچک).
 */
export function paginateArray<T>(
  dataset: T[],
  pagination: NormalizedPagination,
): Paginated<T> {
  const total = dataset.length;
  const pageItems = dataset.slice(
    pagination.skip,
    pagination.skip + pagination.take,
  );
  return {
    items: pageItems,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}
