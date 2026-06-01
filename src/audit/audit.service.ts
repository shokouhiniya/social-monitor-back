import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { SafeUser } from '../users/user.types';

/**
 * انواع اقدام‌های حساس قابل‌ثبت (Requirement 11.5 / design §6.9).
 *
 * این فهرست به‌صورت string union باز نگه داشته شده تا ماژول‌های مصرف‌کننده
 * (Sources، Jobs، Prompts، Settings، Operations) بتوانند به‌تدریج اقدام‌های خود
 * را ثبت کنند بدون نیاز به تغییر این فایل در هر مرحله.
 */
export type AuditAction =
  | 'source.create'
  | 'source.delete'
  | 'job.batch_refresh'
  | 'prompt.activate_version'
  | 'settings.change_api_key'
  | 'settings.change_model'
  | 'alert.create'
  | 'alert.change'
  | 'action_plan.create'
  | 'action_plan.change'
  | (string & {});

/** موجودیت هدف یک اقدام ممیزی (اختیاری). */
export interface AuditTarget {
  entityType: string;
  entityId: string | number;
}

/**
 * سرویس ثبت ممیزی (AuditService — design §5.12 / §6.9).
 *
 * `record()` یک رکورد در جدول `audit_logs` درج می‌کند (Requirement 11.5).
 *
 * **تصمیم مرزی (محدودهٔ wiring):** خود این سرویس به‌صورت کامل پیاده و export
 * می‌شود. اتصال (wire) آن به جریان‌های حساس (ایجاد/حذف source، batch refresh،
 * تغییر نسخهٔ فعال prompt، تغییر API key/model، ایجاد/تغییر alert و action plan)
 * می‌تواند به‌صورت افزایشی در همان تسک‌های مربوطه انجام شود. در این تسک، سرویس
 * آماده و در دسترس ماژول‌های دیگر قرار می‌گیرد.
 *
 * `record()` هرگز استثنا نشت نمی‌دهد: ممیزی یک نگرانی جانبی (cross-cutting) است
 * و شکست در ثبت لاگ نباید جریان اصلی کسب‌وکار را بشکند؛ خطا تنها لاگ می‌شود.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * ثبت یک رکورد ممیزی. `actor` ممکن است `null` باشد (اقدام سیستمی/بدون کاربر).
   * در صورت خطای پایگاه‌داده، خطا لاگ و بلعیده می‌شود تا جریان اصلی نشکند.
   */
  async record(
    action: AuditAction,
    actor: SafeUser | null,
    target?: AuditTarget,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const entity = this.auditRepository.create({
        actor_user_id: actor?.id ?? null,
        action,
        entity_type: target?.entityType ?? null,
        entity_id:
          target?.entityId !== undefined && target?.entityId !== null
            ? String(target.entityId)
            : null,
        meta: meta ?? null,
      });
      await this.auditRepository.save(entity);
    } catch (error) {
      // ممیزی نباید جریان اصلی را بشکند (Requirement 11.5 — ثبت best-effort).
      this.logger.error(
        `ثبت رکورد ممیزی برای اقدام «${action}» ناموفق بود`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
