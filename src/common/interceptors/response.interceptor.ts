import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { buildSuccessEnvelope, SuccessEnvelope } from '../utils/envelope';

/**
 * ResponseInterceptor — شاخهٔ موفق Response Envelope را یکدست می‌کند (Requirement 12.1, 12.3).
 *
 * خروجی هر controller را در قالب `{ meta: { status: 'success', timestamp }, data }`
 * می‌پوشاند که در آن `timestamp` یک رشتهٔ معتبر ISO-8601 است
 * (`new Date(ts).toISOString() === ts`).
 *
 * نکته: شاخهٔ خطا اینجا مدیریت نمی‌شود؛ مدیریت خطا به `AllExceptionsFilter`
 * (تسک ۱.۳) واگذار شده تا envelope خطا با `error.code` نمادین تولید شود. هر دو
 * مسیر از helper مشترک `buildEnvelope`/`buildSuccessEnvelope` در
 * `common/utils/envelope.ts` استفاده می‌کنند تا قالب پاسخ یکدست بماند.
 */
@Injectable()
export class ResponseInterceptor<T = unknown>
  implements NestInterceptor<T, SuccessEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T>> {
    return next.handle().pipe(map((data) => buildSuccessEnvelope<T>(data)));
  }
}
