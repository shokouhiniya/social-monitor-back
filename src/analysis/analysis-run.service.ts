import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizePagination,
  paginate,
  Paginated,
  PaginationInput,
} from '../common/pagination';
import { AnalysisRunEntity } from './entities/analysis-run.entity';
import {
  AnalysisRunStatus,
  AnalysisRunType,
} from './analysis.types';

/**
 * سرویس مدیریت چرخهٔ عمر رکورد `analysis_runs` (Requirement 7.6، design §6.3).
 *
 * هر اجرای تحلیل (تک یا دسته‌ای) با یک رکورد `analysis_runs` ردیابی می‌شود:
 *  1. در آغاز اجرا یک رکورد با `status = 'running'` و `started_at = now` ساخته
 *     می‌شود (`start`).
 *  2. حین پردازش، شمارش‌ها به‌روزرسانی می‌شوند (`updateCounts`).
 *  3. در پایان، وضعیت نهایی (succeeded/failed/partial) و `finished_at` ثبت
 *     می‌شود (`finish`).
 *
 * این سرویس وضعیت نهایی را از روی شمارش‌ها به‌صورت قطعی محاسبه می‌کند
 * (`computeFinalStatus`) تا منطق در یک جای واحد و قابل‌تست متمرکز بماند.
 */
@Injectable()
export class AnalysisRunService {
  constructor(
    @InjectRepository(AnalysisRunEntity)
    private readonly runRepository: Repository<AnalysisRunEntity>,
  ) {}

  /**
   * ساخت رکورد اجرای تحلیل در وضعیت `running` با `total` مشخص و
   * `started_at = now` (Requirement 7.6).
   */
  async start(params: {
    type: AnalysisRunType;
    scopeRef?: number | string | null;
    timeframe?: string | null;
    total: number;
    triggeredBy?: number | null;
    now?: Date;
  }): Promise<AnalysisRunEntity> {
    const now = params.now ?? new Date();
    const entity = this.runRepository.create({
      type: params.type,
      scope_ref:
        params.scopeRef === undefined || params.scopeRef === null
          ? null
          : String(params.scopeRef),
      timeframe: params.timeframe ?? null,
      status: 'running',
      total: Math.max(0, params.total),
      succeeded: 0,
      failed: 0,
      started_at: now,
      finished_at: null,
      triggered_by: params.triggeredBy ?? null,
    });
    return this.runRepository.save(entity);
  }

  /**
   * به‌روزرسانی شمارش‌های جاری یک اجرا (succeeded/failed) بدون تغییر وضعیت
   * نهایی. برای گزارش پیشرفت تدریجی در batchهای بزرگ استفاده می‌شود.
   */
  async updateCounts(
    runId: number,
    counts: { succeeded: number; failed: number },
  ): Promise<void> {
    await this.runRepository.update(
      { id: runId },
      {
        succeeded: Math.max(0, counts.succeeded),
        failed: Math.max(0, counts.failed),
      },
    );
  }

  /**
   * نهایی‌سازی یک اجرا: ثبت شمارش‌های نهایی، وضعیت محاسبه‌شده و
   * `finished_at = now` (Requirement 7.6). شیء به‌روزشده برگردانده می‌شود.
   */
  async finish(
    run: AnalysisRunEntity,
    counts: { succeeded: number; failed: number },
    now: Date = new Date(),
  ): Promise<AnalysisRunEntity> {
    const succeeded = Math.max(0, counts.succeeded);
    const failed = Math.max(0, counts.failed);
    run.succeeded = succeeded;
    run.failed = failed;
    run.status = computeFinalStatus(run.total, succeeded, failed);
    run.finished_at = now;
    return this.runRepository.save(run);
  }

  /**
   * فهرست صفحه‌بندی‌شدهٔ اجراهای تحلیل یک scope (مثلاً یک منبع) — مرتب بر اساس
   * جدیدترین (`id DESC`) و مطابق قرارداد Pagination (Requirement 2.8، design
   * §6.3). `scope_ref` در جدول به‌صورت رشته ذخیره می‌شود؛ بنابراین مقدار عددی
   * برای query به رشته تبدیل می‌شود. اگر `types` داده شود، فقط همان نوع‌ها فیلتر
   * می‌شوند (پیش‌فرض: همهٔ نوع‌ها).
   */
  async listByScope(
    scopeRef: number | string,
    pagination: PaginationInput,
    types?: AnalysisRunType[],
  ): Promise<Paginated<AnalysisRunEntity>> {
    const normalized = normalizePagination(pagination);

    const qb = this.runRepository
      .createQueryBuilder('run')
      .where('run.scope_ref = :scopeRef', { scopeRef: String(scopeRef) });

    if (types && types.length > 0) {
      qb.andWhere('run.type IN (:...types)', { types });
    }

    const [items, total] = await qb
      .orderBy('run.id', 'DESC')
      .skip(normalized.skip)
      .take(normalized.take)
      .getManyAndCount();

    return paginate(items, total, normalized);
  }
}

/**
 * محاسبهٔ وضعیت نهایی یک اجرای تحلیل از روی شمارش‌ها (تابع خالص، قابل‌تست).
 *
 * قواعد (Requirement 7.6):
 *  - اگر چیزی برای تحلیل نبوده (`total === 0`) → `succeeded` (اجرای بی‌اثر موفق).
 *  - اگر هیچ شکستی نبوده (`failed === 0`) → `succeeded`.
 *  - اگر هیچ موفقیتی نبوده (`succeeded === 0` و `failed > 0`) → `failed`.
 *  - در غیر این صورت (هم موفق هم ناموفق) → `partial`.
 */
export function computeFinalStatus(
  total: number,
  succeeded: number,
  failed: number,
): AnalysisRunStatus {
  if (total <= 0) return 'succeeded';
  if (failed <= 0) return 'succeeded';
  if (succeeded <= 0) return 'failed';
  return 'partial';
}
