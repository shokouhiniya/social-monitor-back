import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ActionPlan } from '../../modules/action-plan/action-plan.entity';
import {
  InvalidStateTransitionException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';
import { normalizePagination, paginate, Paginated } from '../../common/pagination';
import {
  ActionPlanListQuery,
  CreateActionPlanDto,
  TransitionActionPlanDto,
} from './action-plans.dto';
import {
  ActionPlanStatus,
  ACTION_PLAN_INITIAL_STATUS,
  allowedTargetsForActionPlan,
  canTransitionActionPlan,
} from './action-plan.state-machine';

/**
 * سرویس برنامه‌های عملیاتی (OperationsModule — design §5.10).
 *
 * روی همان جدول موجود `action_plans` و موجودیت موجود `ActionPlan` نگاشت می‌شود
 * (بدون تعریف entity دوم، مطابق الگوی `Source = Page`). ماژول legacy
 * `ActionPlanModule` دست‌نخورده باقی می‌ماند (Requirement 1.6).
 *
 * `list` صفحه‌بندی‌شده (Requirement 9.5)، `create` با وضعیت اولیهٔ معتبر
 * (Requirement 9.4) و `transition` با اعتبارسنجی ماشین وضعیت (Requirement 9.2,
 * 9.3) را ارائه می‌کند.
 */
@Injectable()
export class ActionPlansService {
  constructor(
    @InjectRepository(ActionPlan)
    private readonly actionPlanRepository: Repository<ActionPlan>,
  ) {}

  /** فهرست صفحه‌بندی‌شدهٔ برنامه‌های عملیاتی (Requirement 9.5, 12.5-12.7). */
  async list(query: ActionPlanListQuery): Promise<Paginated<ActionPlan>> {
    const pagination = normalizePagination(query);

    const where: FindOptionsWhere<ActionPlan> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.assigned_to) {
      where.assigned_to = query.assigned_to;
    }
    if (query.sourceId !== undefined) {
      where.page_id = query.sourceId;
    }
    if (query.clusterId !== undefined) {
      where.cluster_id = query.clusterId;
    }

    const [items, total] = await this.actionPlanRepository.findAndCount({
      where,
      relations: ['page', 'alert'],
      order: { priority: 'DESC', created_at: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items, total, pagination);
  }

  /** یافتن یک برنامهٔ عملیاتی با id؛ در صورت نبود NotFoundException. */
  async findById(id: number): Promise<ActionPlan> {
    const plan = await this.actionPlanRepository.findOne({
      where: { id },
      relations: ['page', 'alert', 'interactions'],
    });
    if (!plan) {
      throw new NotFoundException(`برنامهٔ عملیاتی با شناسهٔ ${id} یافت نشد`);
    }
    return plan;
  }

  /**
   * ساخت یک برنامهٔ عملیاتی جدید با وضعیت اولیهٔ معتبر `todo` (Requirement 9.4).
   * مطابق منطق legacy، یکی از `page_id` یا `cluster_id` باید مشخص شود.
   */
  async create(dto: CreateActionPlanDto): Promise<ActionPlan> {
    if (dto.page_id === undefined && dto.cluster_id === undefined) {
      throw new ValidationException(
        'یکی از page_id یا cluster_id باید مشخص شود',
      );
    }

    const plan = this.actionPlanRepository.create({
      page_id: dto.page_id,
      cluster_id: dto.cluster_id,
      alert_id: dto.alert_id,
      title: dto.title,
      description: dto.description,
      priority: dto.priority ?? 0,
      category: dto.category,
      assigned_to: dto.assigned_to,
      suggested_content: dto.suggested_content,
      suggested_tone: dto.suggested_tone,
      due_date: dto.due_date,
      contact_info: dto.contact_info ?? null,
      recommended_pages: dto.recommended_pages ?? null,
      status: ACTION_PLAN_INITIAL_STATUS,
    });

    return this.actionPlanRepository.save(plan);
  }

  /**
   * گذار وضعیت یک برنامهٔ عملیاتی با اعتبارسنجی ماشین وضعیت (Requirement 9.2, 9.3).
   *
   * Atomicity: اعتبارسنجی پیش از هرگونه تغییر یا persist انجام می‌شود؛ گذار
   * غیرمجاز با `InvalidStateTransitionException` رد می‌شود و وضعیت موجودیت
   * دست‌نخورده می‌ماند.
   */
  async transition(
    id: number,
    dto: TransitionActionPlanDto,
  ): Promise<ActionPlan> {
    const plan = await this.findById(id);
    const from = plan.status as ActionPlanStatus;
    const to = dto.to as ActionPlanStatus;

    if (!canTransitionActionPlan(from, to)) {
      throw new InvalidStateTransitionException(
        `گذار وضعیت برنامهٔ عملیاتی از «${from}» به «${to}» مجاز نیست`,
        {
          entity: 'ActionPlan',
          from,
          to,
          allowed: allowedTargetsForActionPlan(from),
        },
      );
    }

    plan.status = to;
    return this.actionPlanRepository.save(plan);
  }
}
