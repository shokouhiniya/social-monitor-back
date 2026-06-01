import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  DomainException,
  ERROR_CODES,
  ErrorCode,
} from '../exceptions/domain.exception';
import { buildErrorEnvelope, ErrorPayload } from '../utils/envelope';

/**
 * Global Exception Filter (Requirement 12.2, 12.4 / design §11.1).
 *
 * هر استثنا را به envelope خطای یکدست تبدیل می‌کند:
 *   { meta: { status: 'error', timestamp: <ISO-8601> },
 *     error: { code, message, details } }
 *
 * قوانین نگاشت:
 *  - `DomainException` → از `code`/`httpStatus`/`details` خودش استفاده می‌شود.
 *  - `HttpException` (شامل خطای `ValidationPipe`) → بر اساس HTTP status به کد
 *    نمادین نگاشت می‌شود؛ خطای اعتبارسنجی به `VALIDATION_ERROR` با `details`
 *    فیلد‌محور تبدیل می‌گردد.
 *  - خطای ناشناخته → `INTERNAL_ERROR` با پیام عمومی (بدون نشت جزئیات داخلی) و
 *    log کامل با stack در سمت سرور.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { httpStatus, payload, logAsServerError } =
      this.resolveError(exception);

    if (logAsServerError) {
      // خطای غیرمنتظره/سرور: log کامل با stack برای مشاهده‌پذیری.
      this.logger.error(
        `Unhandled exception on ${request?.method} ${request?.url}: ${this.describe(
          exception,
        )}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      // خطای دامنه‌ای/کلاینت: log سطح پایین‌تر برای ردیابی، بدون stack.
      this.logger.warn(
        `${payload.code} on ${request?.method} ${request?.url}: ${payload.message}`,
      );
    }

    const envelope = buildErrorEnvelope(payload);
    response.status(httpStatus).json(envelope);
  }

  /**
   * تشخیص نوع استثنا و تولید کد نمادین، status و payload متناظر.
   */
  private resolveError(exception: unknown): {
    httpStatus: number;
    payload: ErrorPayload;
    logAsServerError: boolean;
  } {
    // ۱) خطای دامنه‌ای با کد نمادین صریح.
    if (exception instanceof DomainException) {
      return {
        httpStatus: exception.httpStatus,
        payload: {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined
            ? { details: exception.details }
            : {}),
        },
        logAsServerError:
          exception.httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // ۲) خطای HTTP داخلی Nest (شامل خطای ValidationPipe).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = this.statusToCode(status);
      const { message, details } = this.extractHttpExceptionBody(
        exception,
        code,
      );
      return {
        httpStatus: status,
        payload: {
          code,
          message,
          ...(details !== undefined ? { details } : {}),
        },
        logAsServerError: status >= HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // ۳) خطای ناشناخته → INTERNAL_ERROR بدون نشت جزئیات.
    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      payload: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'An internal server error occurred',
      },
      logAsServerError: true,
    };
  }

  /**
   * نگاشت HTTP status به کد نمادین.
   */
  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.GATEWAY_TIMEOUT:
        return ERROR_CODES.AI_TIMEOUT;
      case HttpStatus.BAD_GATEWAY:
        return ERROR_CODES.AI_PROVIDER_ERROR;
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? ERROR_CODES.INTERNAL_ERROR
          : ERROR_CODES.VALIDATION_ERROR;
    }
  }

  /**
   * استخراج پیام و جزئیات از بدنهٔ HttpException.
   * برای خطای ValidationPipe، آرایهٔ پیام‌ها به `details.messages` منتقل می‌شود.
   */
  private extractHttpExceptionBody(
    exception: HttpException,
    code: ErrorCode,
  ): { message: string; details?: unknown } {
    const res = exception.getResponse();

    if (typeof res === 'string') {
      return { message: res };
    }

    if (res && typeof res === 'object') {
      const body = res as Record<string, unknown>;
      const rawMessage = body.message;

      // ValidationPipe پیام‌ها را به‌صورت آرایه برمی‌گرداند.
      if (Array.isArray(rawMessage)) {
        return {
          message:
            code === ERROR_CODES.VALIDATION_ERROR
              ? 'Validation failed'
              : exception.message,
          details: { messages: rawMessage },
        };
      }

      if (typeof rawMessage === 'string') {
        return { message: rawMessage };
      }
    }

    return { message: exception.message };
  }

  /**
   * توصیف امن استثنا برای log سمت سرور (نه برای پاسخ کلاینت).
   */
  private describe(exception: unknown): string {
    if (exception instanceof Error) {
      return `${exception.name}: ${exception.message}`;
    }
    try {
      return JSON.stringify(exception);
    } catch {
      return String(exception);
    }
  }
}
