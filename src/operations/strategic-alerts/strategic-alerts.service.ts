import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { StrategicAlert } from '../../modules/strategic-alert/strategic-alert.entity';
import {
  InvalidStateTransitionException,
  NotFoundException,
} from '../../common/exceptions';
import { normalizePagination, paginate, Paginated } from '../../common/pagination';
import { AlertListQuery, CreateAlertDto, TransitionAlertDto } from './strategic-alerts.dto';
import {
  AlertStatus,
  ALERT_INITIAL_STATUS,
  allowedTargetsForAlert,
  canTransitionAlert,
} from './strategic-alert.state-machine';

/**
 * سرویس هشدارهای راهبردی (OperationsModule — design §5.10).
 *
 * روی همان جدول موجود `strategic_alerts` و موجودیت موجود `StrategicAlert` نگاشت
 * می‌شود (بدون تعریف entity دوم، مطابق الگوی `Source = Page` در تسک ۳.۴) تا
 * تعارض metadata در TypeORM رخ ندهد. ماژول legacy `StrategicAlertModule` دست‌نخورده
 * باقی می‌ماند (Requirement 1.6).
 *
 * این سرویس `list` صفحه‌بندی‌شده (Requirement 9.5)، `create` با وضعیت اولیهٔ
 * معتبر (Requirement 9.4) و `transition` با اعتبارسنجی ماشین وضعیت
 * (Requirement 9.1, 9.3) را ارائه می‌کند.
 */
@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(StrategicAlert)
    private readonly alertRepository: Repository<StrategicAlert>,
  ) {}

  /** فهرست صفحه‌بندی‌شدهٔ هشدارها مطابق قرارداد Pagination (Requirement 9.5, 12.5-12.7). */
  async list(query: AlertListQuery): Promise<Paginated<StrategicAlert>> {
    const pagination = normalizePagination(query);

    const where: FindOptionsWhere<StrategicAlert> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.category) {
      where.category = query.category;
    }

    const [items, total] = await this.alertRepository.findAndCount({
      where,
      order: { created_at: 'DESC', id: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items, total, pagination);
  }

  /** یافتن یک هشدار با id؛ در صورت نبود NotFoundException. */
  async findById(id: number): Promise<StrategicAlert> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`هشداری با شناسهٔ ${id} یافت نشد`);
    }
    return alert;
  }

  /**
   * ساخت یک هشدار جدید با وضعیت اولیهٔ معتبر `active` (Requirement 9.4).
   * وضعیت همیشه توسط سرویس تنظیم می‌شود و از ورودی پذیرفته نمی‌شود.
   */
  async create(dto: CreateAlertDto): Promise<StrategicAlert> {
    const targetCount = dto.target_pages?.length ?? 0;

    const alert = this.alertRepository.create({
      title: dto.title,
      message: dto.message,
      priority: dto.priority,
      category: dto.category,
      target_pages: dto.target_pages,
      created_by: dto.created_by,
      assigned_to: dto.assigned_to,
      evidence_url: dto.evidence_url,
      group_key: dto.group_key,
      involved_pages_count: targetCount,
      status: ALERT_INITIAL_STATUS,
    });

    return this.alertRepository.save(alert);
  }

  /**
   * گذار وضعیت یک هشدار با اعتبارسنجی ماشین وضعیت (Requirement 9.1, 9.3).
   *
   * Atomicity: اعتبارسنجی *پیش از* هرگونه تغییر یا persist انجام می‌شود. اگر گذار
   * غیرمجاز باشد، `InvalidStateTransitionException` پرتاب می‌شود و هیچ `save` ای
   * رخ نمی‌دهد؛ بنابراین وضعیت موجودیت در دیتابیس دست‌نخورده می‌ماند و خواندن
   * مجدد همان وضعیت قبلی را برمی‌گرداند.
   */
  async transition(
    id: number,
    dto: TransitionAlertDto,
  ): Promise<StrategicAlert> {
    const alert = await this.findById(id);
    const from = alert.status as AlertStatus;
    const to = dto.to as AlertStatus;

    if (!canTransitionAlert(from, to)) {
      throw new InvalidStateTransitionException(
        `گذار وضعیت هشدار از «${from}» به «${to}» مجاز نیست`,
        {
          entity: 'StrategicAlert',
          from,
          to,
          allowed: allowedTargetsForAlert(from),
        },
      );
    }

    // فقط پس از تأیید مجاز بودن گذار، وضعیت تغییر و ذخیره می‌شود (atomicity).
    alert.status = to;
    if (dto.assigned_to !== undefined) {
      alert.assigned_to = dto.assigned_to;
    }
    return this.alertRepository.save(alert);
  }
}
