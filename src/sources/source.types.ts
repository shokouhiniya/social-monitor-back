import { Page } from '../modules/page/page.entity';

/**
 * انواع و ثابت‌های مشترک SourcesModule (design §5.2).
 *
 * مفهوم «Source» (منبع پایش) جانشین مفهومی `Page` است و دقیقاً روی همان جدول
 * `pages` نگاشت می‌شود. برای جلوگیری از تعارض metadata در TypeORM (دو کلاس روی یک
 * جدول)، به‌جای تعریف یک entity جدید، همان موجودیت موجود `Page` دوباره استفاده
 * می‌شود و در این لایه با نام مفهومی `Source` در دسترس قرار می‌گیرد.
 */
export type Source = Page;

/**
 * پلتفرم‌های پشتیبانی‌شدهٔ منبع (design §Glossary — Platform).
 */
export const SOURCE_PLATFORMS = ['instagram', 'telegram', 'twitter'] as const;
export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

/**
 * وضعیت فعال/غیرفعال منبع. مقدار `status` از ستون `is_active` مشتق می‌شود
 * (design §6.2): `active ⟺ is_active = true`، `inactive ⟺ is_active = false`.
 * منابع `inactive` از واکشی خودکار کنار گذاشته می‌شوند (Requirement 2.6).
 */
export const SOURCE_STATUSES = ['active', 'inactive'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** نگاشت وضعیت → مقدار boolean ستون `is_active`. */
export function statusToIsActive(status: SourceStatus): boolean {
  return status === 'active';
}

/** نگاشت مقدار boolean ستون `is_active` → وضعیت مفهومی. */
export function isActiveToStatus(isActive: boolean): SourceStatus {
  return isActive ? 'active' : 'inactive';
}
