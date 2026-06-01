import { User } from '../modules/user/user.entity';

/**
 * نقش‌های کاربری سیستم (Requirement 11.3).
 *
 * هر کاربر دقیقاً یکی از این نقش‌ها را دارد:
 *  - `admin`: دسترسی کامل شامل مدیریت تنظیمات سراسری و Prompt Studio و کاربران.
 *  - `operator`: اجرای جریان‌های عملیاتی (منابع، واکشی، تحلیل، هشدارها، Job ها).
 *  - `viewer`: دسترسی فقط‌خواندنی به داشبوردها و گزارش‌ها.
 */
export const USER_ROLES = ['admin', 'operator', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** نقش پیش‌فرض هنگام نبود مقدار صریح. */
export const DEFAULT_USER_ROLE: UserRole = 'viewer';

/** آیا یک رشته یک نقش معتبر است؟ (نگهبان نوع). */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
  );
}

/**
 * نسخهٔ امن کاربر برای بازگردانده‌شدن به کلاینت و حمل در payload توکن
 * (Requirement 11.1). فیلد حساس `password_hash` عمداً حذف شده است.
 */
export interface SafeUser {
  id: number;
  name: string;
  username: string | null;
  role: UserRole;
  is_active: boolean;
}

/**
 * نگاشت یک موجودیت `User` به `SafeUser` با حذف `password_hash` و نرمال‌سازی نقش.
 * اگر نقش ذخیره‌شده نامعتبر/خالی باشد، به `viewer` نرمال می‌شود تا همواره دقیقاً
 * یکی از نقش‌های معتبر بازگردانده شود (Requirement 11.3).
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? null,
    role: isUserRole(user.role) ? user.role : DEFAULT_USER_ROLE,
    is_active: user.is_active,
  };
}
