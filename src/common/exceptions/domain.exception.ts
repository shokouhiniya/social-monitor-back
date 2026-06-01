import { HttpStatus } from '@nestjs/common';

/**
 * کدهای خطای نمادین دامنه (Requirement 12.4 / design §11.1).
 *
 * فرانت‌اند بر اساس این کدها پیام فارسی معنادار نمایش می‌دهد؛ بنابراین مقادیر
 * نباید بی‌دلیل تغییر کنند.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  JOB_TASK_FAILED: 'JOB_TASK_FAILED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * نگاشت پیش‌فرض کد نمادین به HTTP status. در صورت عدم تعیین صریحِ status هنگام
 * پرتاب خطا، از این جدول استفاده می‌شود.
 */
export const ERROR_CODE_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CONFLICT: HttpStatus.CONFLICT,
  AI_PROVIDER_ERROR: HttpStatus.BAD_GATEWAY,
  AI_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  JOB_TASK_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_STATE_TRANSITION: HttpStatus.CONFLICT,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * استثنای پایهٔ دامنه. سرویس‌ها با پرتاب `DomainException` (یا زیرکلاس‌های آن)
 * یک کد نمادین صریح ارائه می‌کنند تا `AllExceptionsFilter` بتواند envelope خطای
 * درست را بسازد، بدون اتکا به صرفِ statusCode عددی.
 */
export class DomainException extends Error {
  /** کد نمادین خطا. */
  readonly code: ErrorCode;
  /** HTTP status متناظر برای پاسخ. */
  readonly httpStatus: number;
  /** جزئیات اختیاری و قابل‌نمایش به کلاینت (فاقد اطلاعات حساس). */
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; httpStatus?: number },
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = options?.httpStatus ?? ERROR_CODE_HTTP_STATUS[code];
    this.details = options?.details;
    // حفظ زنجیرهٔ prototype هنگام transpile به ES5/CommonJS.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/* ------------------------------------------------------------------ */
/* زیرکلاس‌های سهولت (اختیاری) برای کدهای پرکاربرد دامنه.               */
/* ------------------------------------------------------------------ */

export class ValidationException extends DomainException {
  constructor(message = 'Validation failed', details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, { details });
  }
}

export class NotFoundException extends DomainException {
  constructor(message = 'Resource not found', details?: unknown) {
    super(ERROR_CODES.NOT_FOUND, message, { details });
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(ERROR_CODES.UNAUTHORIZED, message, { details });
  }
}

export class ForbiddenException extends DomainException {
  constructor(message = 'Forbidden', details?: unknown) {
    super(ERROR_CODES.FORBIDDEN, message, { details });
  }
}

export class ConflictException extends DomainException {
  constructor(message = 'Conflict', details?: unknown) {
    super(ERROR_CODES.CONFLICT, message, { details });
  }
}

export class InvalidStateTransitionException extends DomainException {
  constructor(message = 'Invalid state transition', details?: unknown) {
    super(ERROR_CODES.INVALID_STATE_TRANSITION, message, { details });
  }
}
