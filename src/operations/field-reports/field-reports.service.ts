import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { FieldReport } from '../../modules/field-report/field-report.entity';
import { normalizePagination, paginate, Paginated } from '../../common/pagination';
import { CreateFieldReportDto, FieldReportListQuery } from './field-reports.dto';

/** وضعیت اولیهٔ معتبر هنگام ایجاد یک FieldReport (Requirement 9.4). */
export const FIELD_REPORT_INITIAL_STATUS = 'pending';

/**
 * سرویس گزارش‌های میدانی (OperationsModule — design §5.10).
 *
 * روی همان جدول موجود `field_reports` و موجودیت موجود `FieldReport` نگاشت می‌شود
 * (بدون تعریف entity دوم). ماژول legacy `FieldReportModule` دست‌نخورده باقی
 * می‌ماند (Requirement 1.6).
 *
 * FieldReport گردش‌کار وضعیتِ گذارمحور مثل Alert/ActionPlan ندارد؛ تنها `list`
 * (Requirement 9.5) و `create` با وضعیت اولیهٔ معتبر (Requirement 9.4) ارائه
 * می‌شود.
 */
@Injectable()
export class FieldReportsService {
  constructor(
    @InjectRepository(FieldReport)
    private readonly fieldReportRepository: Repository<FieldReport>,
  ) {}

  /** فهرست صفحه‌بندی‌شدهٔ گزارش‌های میدانی (Requirement 9.5, 12.5-12.7). */
  async list(query: FieldReportListQuery): Promise<Paginated<FieldReport>> {
    const pagination = normalizePagination(query);

    const where: FindOptionsWhere<FieldReport> = {};
    if (query.sourceId !== undefined) {
      where.page_id = query.sourceId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.fieldReportRepository.findAndCount({
      where,
      relations: ['page'],
      order: { created_at: 'DESC', id: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items, total, pagination);
  }

  /**
   * ساخت یک گزارش میدانی جدید با وضعیت اولیهٔ معتبر `pending` (Requirement 9.4).
   */
  async create(dto: CreateFieldReportDto): Promise<FieldReport> {
    const report = this.fieldReportRepository.create({
      page_id: dto.page_id,
      reporter_id: dto.reporter_id,
      content: dto.content,
      source_type: dto.source_type,
      file_url: dto.file_url,
      extracted_keywords: dto.extracted_keywords,
      sentiment: dto.sentiment,
      is_override: dto.is_override ?? false,
      override_note: dto.override_note,
      status: FIELD_REPORT_INITIAL_STATUS,
    });
    return this.fieldReportRepository.save(report);
  }
}
