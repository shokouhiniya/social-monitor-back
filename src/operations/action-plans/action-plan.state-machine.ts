import {
  TransitionMap,
  allowedTargets,
  canTransition,
} from '../state-machines/state-machine.util';

/**
 * ماشین وضعیت ActionPlan (design §5.10 / Requirement 9.2).
 *
 * گذارهای مستند:
 *   todo → in_progress → done
 *   * → cancelled   (از هر وضعیتی به‌جز `done`)
 *
 * بنابراین:
 *  - `todo`        → `in_progress` یا `cancelled`
 *  - `in_progress` → `done` یا `cancelled`
 *  - `done`        وضعیت پایانی است؛ هیچ گذاری (حتی به `cancelled`) مجاز نیست.
 *  - `cancelled`   وضعیت پایانی است.
 *
 * هر گذار خارج از این نقشه (مثلاً `done → cancelled` یا `todo → done`) غیرمجاز
 * است و باید با `INVALID_STATE_TRANSITION` رد شود (Requirement 9.3).
 */
export const ACTION_PLAN_STATUSES = [
  'todo',
  'in_progress',
  'done',
  'cancelled',
] as const;

export type ActionPlanStatus = (typeof ACTION_PLAN_STATUSES)[number];

/** وضعیت اولیهٔ معتبر هنگام ایجاد یک ActionPlan (Requirement 9.4). */
export const ACTION_PLAN_INITIAL_STATUS: ActionPlanStatus = 'todo';

/**
 * نقشهٔ گذارهای مجاز ActionPlan. قاعدهٔ «`* → cancelled` به‌جز از `done`» به‌صورت
 * صریح در هر سطرِ غیرپایانی کدگذاری شده تا تابع `canTransition` خالص بماند.
 */
export const ACTION_PLAN_TRANSITIONS: TransitionMap<ActionPlanStatus> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

/** آیا گذار وضعیت روی ActionPlan مجاز و مستند است؟ (تابع خالص) */
export function canTransitionActionPlan(
  from: ActionPlanStatus,
  to: ActionPlanStatus,
): boolean {
  return canTransition(ACTION_PLAN_TRANSITIONS, from, to);
}

/** فهرست وضعیت‌های مقصدِ مجاز از یک وضعیت مشخص (برای پیام خطا/UI). */
export function allowedTargetsForActionPlan(
  from: ActionPlanStatus,
): readonly ActionPlanStatus[] {
  return allowedTargets(ACTION_PLAN_TRANSITIONS, from);
}
