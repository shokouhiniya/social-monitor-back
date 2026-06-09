import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Interaction } from '../modules/interaction/interaction.entity';
import { MicroMediaEntity } from './micro-media.entity';
import { User } from '../modules/user/user.entity';
import {
  CreateInteractionV2Dto,
  InteractionV2ListQuery,
} from './interactions-v2.dto';
import { normalizePagination, paginate, Paginated } from '../common/pagination';

/**
 * سرویس تعاملات نسخهٔ جدید (design §3.6). روی همان جدول `interactions` کار می‌کند
 * (entity گسترش‌یافته)، بدون entity دوم.
 *
 * قاعدهٔ فعال بودن (Correctness Property 2): یک میکرورسانه در یک بازه فعال است
 * اگر حداقل یک تعامل با `interaction_date` در آن بازه داشته باشد.
 */
@Injectable()
export class InteractionsV2Service {
  constructor(
    @InjectRepository(Interaction)
    private readonly interactionRepo: Repository<Interaction>,
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateInteractionV2Dto): Promise<Interaction> {
    const interaction = this.interactionRepo.create({
      micro_media_id: dto.micro_media_id,
      hub_id: dto.hub_id ?? null,
      operation_id: dto.operation_id ?? null,
      task_id: dto.task_id ?? null,
      owner_user_id: dto.owner_user_id ?? null,
      type: dto.interaction_type,
      interaction_date: dto.interaction_date
        ? new Date(dto.interaction_date)
        : new Date(),
      summary: dto.summary ?? null,
      result: dto.result ?? 'success',
      next_action: dto.next_action ?? null,
      tags: dto.tags ?? null,
      // ستون‌های legacy غیر-null: responsible را با owner یا مقدار پیش‌فرض پر می‌کنیم.
      responsible: dto.owner_user_id ? String(dto.owner_user_id) : 'system',
    });
    return this.interactionRepo.save(interaction);
  }

  async list(
    query: InteractionV2ListQuery,
    scope?: { privileged: boolean; hubIds: number[] },
  ): Promise<
    Paginated<
      Interaction & { micro_media_name: string | null; owner_name: string | null }
    >
  > {
    const pagination = normalizePagination(query);
    const where: Record<string, unknown> = {};
    if (query.microMediaId) where.micro_media_id = query.microMediaId;
    if (query.hubId) where.hub_id = query.hubId;
    if (query.operationId) where.operation_id = query.operationId;
    if (query.taskId) where.task_id = query.taskId;
    if (query.type) where.type = query.type;

    // scope هاب: کاربر غیرفراگیر تنها تعاملات هاب‌های خودش را می‌بیند.
    if (scope && !scope.privileged) {
      where.hub_id = In(scope.hubIds);
    }

    const [items, total] = await this.interactionRepo.findAndCount({
      where,
      order: { interaction_date: 'DESC', id: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    // غنی‌سازی با نام میکرورسانه و نام مسئول (queryهای تجمیعی — بدون N+1).
    const mediaIds = Array.from(
      new Set(items.map((i) => i.micro_media_id).filter((v): v is number => v != null)),
    );
    const nameMap = new Map<number, string>();
    if (mediaIds.length) {
      const medias = await this.mediaRepo.find({ where: { id: In(mediaIds) } });
      medias.forEach((m) => nameMap.set(m.id, m.name));
    }

    const ownerIds = Array.from(
      new Set(items.map((i) => i.owner_user_id).filter((v): v is number => v != null)),
    );
    const ownerMap = new Map<number, string>();
    if (ownerIds.length) {
      const owners = await this.userRepo.find({ where: { id: In(ownerIds) } });
      owners.forEach((u) => ownerMap.set(u.id, u.name));
    }

    const enriched = items.map((i) => ({
      ...i,
      micro_media_name: i.micro_media_id ? nameMap.get(i.micro_media_id) ?? null : null,
      // «چه کسی تعامل کرده»: نام کاربرِ مسئول؛ در نبود آن، فیلد legacy `responsible`.
      owner_name: i.owner_user_id
        ? ownerMap.get(i.owner_user_id) ?? null
        : i.responsible && i.responsible !== 'system'
          ? i.responsible
          : null,
    }));

    return paginate(enriched, total, pagination);
  }

  /** آمار خلاصهٔ تعاملات برای کارت‌های بالای صفحه. */
  async overview(): Promise<{
    total: number;
    last30Days: number;
    activeMediaLast6Months: number;
  }> {
    const total = await this.interactionRepo.count();

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const last30Days = await this.interactionRepo.count({
      where: { interaction_date: MoreThanOrEqual(since30) },
    });

    const since6m = new Date();
    since6m.setMonth(since6m.getMonth() - 6);
    const activeMediaLast6Months = (await this.mediaIdsActiveSince(since6m)).length;

    return { total, last30Days, activeMediaLast6Months };
  }

  async listForMedia(microMediaId: number): Promise<Interaction[]> {
    return this.interactionRepo.find({
      where: { micro_media_id: microMediaId },
      order: { interaction_date: 'DESC', id: 'DESC' },
    });
  }

  /** آخرین تاریخ تعامل یک میکرورسانه (یا null). */
  async lastInteractionDate(microMediaId: number): Promise<Date | null> {
    const last = await this.interactionRepo.findOne({
      where: { micro_media_id: microMediaId },
      order: { interaction_date: 'DESC' },
    });
    return last?.interaction_date ?? null;
  }

  /** آیا میکرورسانه از تاریخ `since` به بعد حداقل یک تعامل داشته است؟ */
  async isActiveSince(microMediaId: number, since: Date): Promise<boolean> {
    const count = await this.interactionRepo.count({
      where: {
        micro_media_id: microMediaId,
        interaction_date: MoreThanOrEqual(since),
      },
    });
    return count > 0;
  }

  /** شناسهٔ میکرورسانه‌هایی که از `since` به بعد تعامل داشته‌اند. */
  async mediaIdsActiveSince(since: Date): Promise<number[]> {
    const rows = await this.interactionRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.micro_media_id', 'mid')
      .where('i.micro_media_id IS NOT NULL')
      .andWhere('i.interaction_date >= :since', { since })
      .getRawMany<{ mid: number }>();
    return rows.map((r) => r.mid).filter((v) => v != null);
  }

  /**
   * آمار تجمیعی تعاملات برای فهرستی از میکرورسانه‌ها (برای ستون «تعاملات اخیر»
   * در جدول لیست). برای هر شناسه: آخرین تاریخ تعامل و تعداد کل تعاملات.
   */
  async statsForMediaIds(
    ids: number[],
  ): Promise<Map<number, { last: Date | null; count: number }>> {
    const map = new Map<number, { last: Date | null; count: number }>();
    if (ids.length === 0) return map;
    const rows = await this.interactionRepo
      .createQueryBuilder('i')
      .select('i.micro_media_id', 'mid')
      .addSelect('MAX(i.interaction_date)', 'last')
      .addSelect('COUNT(*)', 'cnt')
      .where('i.micro_media_id IN (:...ids)', { ids })
      .groupBy('i.micro_media_id')
      .getRawMany<{ mid: number; last: string | null; cnt: string }>();
    for (const r of rows) {
      map.set(Number(r.mid), {
        last: r.last ? new Date(r.last) : null,
        count: Number(r.cnt),
      });
    }
    return map;
  }

  /** شناسهٔ میکرورسانه‌هایی که از `since` به بعد هیچ تعاملی نداشته‌اند. */
  async mediaIdsInactiveSince(
    allMediaIds: number[],
    since: Date,
  ): Promise<number[]> {
    if (allMediaIds.length === 0) return [];
    const active = new Set(await this.mediaIdsActiveSince(since));
    return allMediaIds.filter((id) => !active.has(id));
  }

  // helper برای استفادهٔ سرویس‌های دیگر؛ از LessThan برای آینده.
  static beforeDate(date: Date) {
    return LessThan(date);
  }
}
