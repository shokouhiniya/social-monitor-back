import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Interaction } from '../../modules/interaction/interaction.entity';
import { normalizePagination, paginate, Paginated } from '../../common/pagination';
import { CreateInteractionDto, InteractionListQuery } from './interactions.dto';

/**
 * سرویس تعاملات (OperationsModule — design §5.10).
 *
 * روی همان جدول موجود `interactions` و موجودیت موجود `Interaction` نگاشت می‌شود
 * (بدون تعریف entity دوم). ماژول legacy `InteractionModule` دست‌نخورده باقی
 * می‌ماند (Requirement 1.6).
 *
 * Interaction گردش‌کار وضعیتِ گذارمحور ندارد؛ بنابراین تنها `list`
 * (Requirement 9.5) و `create` (Requirement 9.4) ارائه می‌شود.
 */
@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Interaction)
    private readonly interactionRepository: Repository<Interaction>,
  ) {}

  /** فهرست صفحه‌بندی‌شدهٔ تعاملات (Requirement 9.5, 12.5-12.7). */
  async list(query: InteractionListQuery): Promise<Paginated<Interaction>> {
    const pagination = normalizePagination(query);

    const where: FindOptionsWhere<Interaction> = {};
    if (query.sourceId !== undefined) {
      where.page_id = query.sourceId;
    }
    if (query.actionPlanId !== undefined) {
      where.action_plan_id = query.actionPlanId;
    }

    const [items, total] = await this.interactionRepository.findAndCount({
      where,
      order: { created_at: 'DESC', id: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items, total, pagination);
  }

  /** ساخت یک تعامل جدید و persist در جدول `interactions` (Requirement 9.4). */
  async create(dto: CreateInteractionDto): Promise<Interaction> {
    const interaction = this.interactionRepository.create({
      page_id: dto.page_id,
      action_plan_id: dto.action_plan_id,
      type: dto.type,
      result: dto.result,
      responsible: dto.responsible,
      note: dto.note,
    });
    return this.interactionRepository.save(interaction);
  }
}
