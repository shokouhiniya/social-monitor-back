import {
  TransitionMap,
  allowedTargets,
  canTransition,
} from '../state-machines/state-machine.util';

/**
 * ماشین وضعیت StrategicAlert (design §5.10 / Requirement 9.1).
 *
 * مسیر اصلی مستند:
 *   active → investigating → needs_response → acknowledged → archived
 *
 * میان‌برهای مستند (طراحی: «و میان‌بر‌های مستند»):
 *  - هر وضعیتِ غیرپایانی می‌تواند مستقیماً به `acknowledged` برسد (تأیید سریع
 *    بدون طی همهٔ مراحل).
 *  - هر وضعیتِ غیرپایانی می‌تواند مستقیماً `archived` شود (بایگانی/بستن سریع).
 *  - از `needs_response` امکان بازگشت به `investigating` وجود دارد (نیاز به
 *    بررسی بیشتر پیش از پاسخ).
 *
 * `archived` وضعیت پایانی است (بدون گذار خروجی). هر گذار خارج از این نقشه
 * غیرمجاز است و باید با `INVALID_STATE_TRANSITION` رد شود (Requirement 9.3).
 */
export const ALERT_STATUSES = [
  'active',
  'investigating',
  'needs_response',
  'acknowledged',
  'archived',
] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** وضعیت اولیهٔ معتبر هنگام ایجاد یک StrategicAlert (Requirement 9.4). */
export const ALERT_INITIAL_STATUS: AlertStatus = 'active';

/**
 * نقشهٔ گذارهای مجاز StrategicAlert. صراحتاً تعریف شده تا هم در سرویس و هم در
 * property test (تسک ۳.۱۳) قابل استفاده باشد.
 */
export const ALERT_TRANSITIONS: TransitionMap<AlertStatus> = {
  active: ['investigating', 'acknowledged', 'archived'],
  investigating: ['needs_response', 'acknowledged', 'archived'],
  needs_response: ['investigating', 'acknowledged', 'archived'],
  acknowledged: ['archived'],
  archived: [],
};

/** آیا گذار وضعیت روی StrategicAlert مجاز و مستند است؟ (تابع خالص) */
export function canTransitionAlert(from: AlertStatus, to: AlertStatus): boolean {
  return canTransition(ALERT_TRANSITIONS, from, to);
}

/** فهرست وضعیت‌های مقصدِ مجاز از یک وضعیت مشخص (برای پیام خطا/UI). */
export function allowedTargetsForAlert(
  from: AlertStatus,
): readonly AlertStatus[] {
  return allowedTargets(ALERT_TRANSITIONS, from);
}
