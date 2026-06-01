/**
 * ابزار خالص (pure) ماشین وضعیت برای OperationsModule (design §5.10 / Requirement 9.1-9.3).
 *
 * یک «نقشهٔ گذارهای مجاز» (`TransitionMap`) از هر وضعیت به مجموعهٔ وضعیت‌های مقصدِ
 * مجاز نگاشت می‌کند. تابع خالص `canTransition` تنها روی همین نقشه تصمیم می‌گیرد و
 * هیچ side-effect یا I/O ندارد؛ بنابراین به‌سادگی هم در سرویس‌ها و هم در
 * property test (تسک ۳.۱۳) قابل استفاده است.
 *
 * نکتهٔ atomicity (Requirement 9.3): اعتبارسنجی گذار باید *پیش از* persist انجام
 * شود. سرویس‌ها ابتدا `canTransition` را صدا می‌زنند و تنها در صورت مجاز بودن،
 * وضعیت را تغییر و ذخیره می‌کنند؛ گذار غیرمجاز هرگز به `save` نمی‌رسد و وضعیت
 * موجودیت دست‌نخورده می‌ماند.
 */

/**
 * نقشهٔ گذارهای مجاز: کلید = وضعیت مبدأ، مقدار = آرایهٔ وضعیت‌های مقصدِ مجاز.
 * وضعیت‌های پایانی (terminal) با آرایهٔ خالی نمایش داده می‌شوند.
 */
export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

/**
 * بررسی می‌کند آیا گذار از `from` به `to` طبق نقشهٔ `map` مجاز است یا نه.
 *
 * - گذار تنها زمانی مجاز است که `to` در فهرست مقصدهای مجازِ `from` باشد.
 * - گذار به خودِ همان وضعیت (`from === to`) به‌صورت پیش‌فرض مجاز نیست مگر آنکه
 *   صراحتاً در نقشه آمده باشد (هیچ no-op ضمنی وجود ندارد).
 * - اگر `from` یا `to` خارج از وضعیت‌های شناخته‌شده باشد، نتیجه `false` است.
 */
export function canTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
): boolean {
  const allowed = map[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

/**
 * فهرست همهٔ وضعیت‌های مقصدِ مجاز از یک وضعیت مشخص (برای نمایش در UI/مستندسازی).
 */
export function allowedTargets<S extends string>(
  map: TransitionMap<S>,
  from: S,
): readonly S[] {
  return map[from] ?? [];
}

/**
 * بررسی می‌کند آیا یک رشتهٔ دلخواه یکی از وضعیت‌های شناخته‌شدهٔ نقشه است یا نه.
 */
export function isKnownStatus<S extends string>(
  map: TransitionMap<S>,
  value: string,
): value is S {
  return Object.prototype.hasOwnProperty.call(map, value);
}
