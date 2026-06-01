/**
 * Shared Response Envelope helpers (Requirement 12.1, 12.3 / Design §7.1).
 *
 * شکل هدف:
 *   موفق: { meta: { status: 'success', timestamp }, data }
 *   خطا:  { meta: { status: 'error',   timestamp }, error: { code, message, details? } }
 *
 * `meta.timestamp` همیشه یک رشتهٔ معتبر ISO-8601 است به‌گونه‌ای که
 * `new Date(ts).toISOString() === ts` در هر دو شاخهٔ موفق و خطا برقرار بماند.
 *
 * این ماژول helper مشترک است: هم `ResponseInterceptor` (تسک ۱.۲، شاخهٔ موفق) و
 * هم `AllExceptionsFilter` (تسک ۱.۳، شاخهٔ خطا) از همین منبع واحد استفاده می‌کنند
 * تا قالب پاسخ یکدست بماند و کد تکراری ساخته نشود.
 */

/** وضعیت envelope: دقیقاً یکی از success یا error. */
export type EnvelopeStatus = 'success' | 'error';

/** متادیتای مشترک هر دو شاخه. */
export interface EnvelopeMeta {
  status: EnvelopeStatus;
  /** رشتهٔ ISO-8601 معتبر؛ `new Date(timestamp).toISOString() === timestamp`. */
  timestamp: string;
}

/** بدنهٔ خطای استاندارد با کد نمادین. */
export interface ErrorPayload {
  /** کد نمادین خطا (مثلاً `VALIDATION_ERROR`)؛ هرگز تهی نیست. */
  code: string;
  message: string;
  details?: unknown;
}

/** envelope شاخهٔ موفق: دارای `data` و فاقد `error`. */
export interface SuccessEnvelope<T = unknown> {
  meta: EnvelopeMeta & { status: 'success' };
  data: T;
}

/** envelope شاخهٔ خطا: دارای `error` و فاقد `data`. */
export interface ErrorEnvelope {
  meta: EnvelopeMeta & { status: 'error' };
  error: ErrorPayload;
}

export type ResponseEnvelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * نتیجهٔ یک handler پیش از قالب‌بندی به envelope؛ یک discriminated union که
 * تضمین می‌کند ورودی دقیقاً یکی از حالت‌های success یا error است (XOR).
 */
export type HandlerOutcome<T = unknown> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: ErrorPayload };

/**
 * تولید timestamp استاندارد ISO-8601.
 * تضمین می‌کند که `new Date(result).toISOString() === result` برقرار باشد.
 */
export function isoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

function buildMeta<S extends EnvelopeStatus>(
  status: S,
  date?: Date,
): EnvelopeMeta & { status: S } {
  return { status, timestamp: isoTimestamp(date) };
}

/** ساخت envelope موفق (شاخهٔ موفق `ResponseInterceptor`). */
export function buildSuccessEnvelope<T>(
  data: T,
  date?: Date,
): SuccessEnvelope<T> {
  return { meta: buildMeta('success', date), data };
}

/** ساخت envelope خطا با کد نمادین (شاخهٔ خطای `AllExceptionsFilter`). */
export function buildErrorEnvelope(
  error: ErrorPayload,
  date?: Date,
): ErrorEnvelope {
  const payload: ErrorPayload = { code: error.code, message: error.message };
  if (error.details !== undefined) {
    payload.details = error.details;
  }
  return { meta: buildMeta('error', date), error: payload };
}

/**
 * dispatcher مشترک: یک `HandlerOutcome` را به envelope مناسب تبدیل می‌کند.
 * این تابع همان قراردادی است که property test تسک ۱.۴ روی آن assert می‌کند
 * (دقیقاً یکی از success|error و timestamp همیشه ISO-8601).
 */
export function buildEnvelope<T>(
  outcome: HandlerOutcome<T>,
  date?: Date,
): ResponseEnvelope<T> {
  if (outcome.status === 'error') {
    return buildErrorEnvelope(outcome.error, date);
  }
  return buildSuccessEnvelope(outcome.data, date);
}
