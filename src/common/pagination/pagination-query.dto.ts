import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE,
  MIN_PAGE_SIZE,
} from './pagination.types';

/**
 * تبدیل ایمن یک مقدار خام به عدد صحیح؛ در صورت نامعتبر بودن `fallback` برگردانده می‌شود.
 */
function toIntOrDefault(value: unknown, fallback: number): number {
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
 * DTO مشترک صفحه‌بندی برای همهٔ endpoint های لیستی.
 *
 * این DTO با `class-validator`/`class-transformer` کار می‌کند و مقادیر خام
 * query string را به عدد تبدیل کرده و در بازه‌های مجاز clamp می‌کند، تا حتی
 * در صورت غیرفعال بودن یا دور زدن ValidationPipe نیز مقادیر امن باقی بمانند.
 *
 * Requirement 12.5: پیش‌فرض `pageSize = 20`.
 * Requirement 12.6: `pageSize` در بازهٔ `[1, 100]` clamp می‌شود و `page >= 1`.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => Math.max(MIN_PAGE, toIntOrDefault(value, DEFAULT_PAGE)))
  @IsInt()
  @Min(MIN_PAGE)
  page: number = DEFAULT_PAGE;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = toIntOrDefault(value, DEFAULT_PAGE_SIZE);
    if (parsed < MIN_PAGE_SIZE) return MIN_PAGE_SIZE;
    if (parsed > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
    return parsed;
  })
  @IsInt()
  @Min(MIN_PAGE_SIZE)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
