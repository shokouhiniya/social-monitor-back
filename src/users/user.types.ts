import { User } from '../modules/user/user.entity';

/**
 * نقش‌های کاربری سیستم.
 *
 * نقش‌های legacy (دورهٔ گذار، حفظ می‌شوند):
 *  - `admin`: دسترسی کامل (نگاشت مفهومی به super_admin).
 *  - `operator`: اجرای جریان‌های عملیاتی.
 *  - `viewer`: فقط‌خواندنی.
 *
 * نقش‌های محصول جدید میکرورسانه (micromedia-transformation §6، تصمیم ۶):
 *  - `super_admin`: مدیر کل سیستم — همه‌چیز.
 *  - `operations_manager`: مدیر عملیات — ساخت عملیات و انتخاب رسانه و تعریف تسک.
 *  - `hub_manager`: مدیر هاب — فقط هاب‌های خودش.
 *  - `hub_expert`: کارشناس هاب — ثبت score/تعامل و پیگیری تسک در هاب خودش.
 */
export const USER_ROLES = [
  'admin',
  'operator',
  'viewer',
  'super_admin',
  'operations_manager',
  'hub_manager',
  'hub_expert',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** نقش‌هایی که دسترسی فراگیر دارند (بدون محدودیت scope هاب). */
export const PRIVILEGED_ROLES: readonly UserRole[] = [
  'admin',
  'super_admin',
  'operations_manager',
];

/** آیا نقش، فراگیر (بدون محدودیت هاب) است؟ */
export function isPrivilegedRole(role: UserRole): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

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
