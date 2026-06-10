import { UserRole } from '../users/user.types';

/**
 * کلید قرارگیری «scope هاب» کاربر روی request پس از عبور از HubScopeGuard.
 * سرویس‌ها می‌توانند آن را بخوانند تا queryهای حساس را به هاب‌های مجاز محدود کنند.
 */
export const REQUEST_HUB_SCOPE_KEY = 'hubScope';

/**
 * نام متغیر محیطیِ فعال‌سازی enforcement احراز هویت/نقش/scope.
 *
 * **تصمیم مرزی امنیتی (غیرتخریبی):** تا وقتی این متغیر صراحتاً `'true'` نباشد،
 * گاردهای جدید هیچ محدودیتی اعمال نمی‌کنند و رفتار «API باز» فعلی حفظ می‌شود
 * (تا فرانت login واقعی را wire کند). با `AUTH_ENFORCE=true` اعمال فعال می‌شود.
 */
export const AUTH_ENFORCE_ENV = 'AUTH_ENFORCE';

/**
 * پیشوندهای مسیرِ محصول جدید میکرورسانه. enforcement تنها روی این مسیرها اعمال
 * می‌شود؛ مسیرهای legacy (مثل `/pages`, `/posts`, `/analytics`) حتی با
 * `AUTH_ENFORCE=true` باز می‌مانند (اصل گذار غیرتخریبی — design §6).
 */
export const NEW_ROUTE_PREFIXES = [
  '/micro-media',
  '/hubs',
  '/tasks',
  '/campaigns',
  '/users',
  '/admin/users',
  '/definitions',
  '/media-score-indicators',
  '/media-score-records',
  '/media-score',
  '/interactions-v2',
  '/dashboards',
];

/** آیا enforcement احراز هویت فعال است؟ */
export function isAuthEnforced(): boolean {
  return (process.env[AUTH_ENFORCE_ENV] ?? 'false').toString().toLowerCase() === 'true';
}

/** آیا این مسیر متعلق به محصول جدید است (مشمول enforcement)؟ */
export function isNewRoute(path: string): boolean {
  const p = (path || '').split('?')[0];
  return NEW_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/** scope هابِ کاربر که به request الصاق می‌شود. */
export interface HubScope {
  userId: number | null;
  role: UserRole | null;
  /** اگر true، کاربر دسترسی فراگیر دارد و نباید بر اساس هاب فیلتر شود. */
  privileged: boolean;
  /** فهرست شناسهٔ هاب‌های مجاز (برای نقش‌های غیرفراگیر). */
  hubIds: number[];
}
