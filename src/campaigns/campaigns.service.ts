import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OperationEntity } from './operation.entity';
import { OperationMediaEntity } from './operation-media.entity';
import { OperationOutputEntity } from './operation-output.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { TaskEntity } from '../tasks/task.entity';
import { User } from '../modules/user/user.entity';
import {
  AddMediaToOperationDto,
  CreateOperationDto,
  CreateOperationOutputDto,
  CreateOperationTaskDto,
  OperationListQueryDto,
  UpdateOperationDto,
} from './campaigns.dto';
import { TasksService } from '../tasks/tasks.service';
import { TaskListQueryDto } from '../tasks/tasks.dto';
import { normalizePagination, paginate, Paginated } from '../common/pagination';
import { DomainException, ERROR_CODES } from '../common/exceptions';

/**
 * سرویس عملیات/کمپین (design §3.8). در سطح HTTP زیر `/campaigns` ارائه می‌شود.
 * تسک‌های عملیات از طریق `TasksService` (با `operation_id`) ساخته می‌شوند.
 */
@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(OperationEntity)
    private readonly opRepo: Repository<OperationEntity>,
    @InjectRepository(OperationMediaEntity)
    private readonly opMediaRepo: Repository<OperationMediaEntity>,
    @InjectRepository(OperationOutputEntity)
    private readonly opOutputRepo: Repository<OperationOutputEntity>,
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tasksService: TasksService,
  ) {}

  async findById(id: number): Promise<OperationEntity> {
    const op = await this.opRepo.findOne({ where: { id } });
    if (!op) {
      throw new DomainException(
        ERROR_CODES.OPERATION_NOT_FOUND,
        `عملیاتی با شناسهٔ ${id} یافت نشد`,
      );
    }
    return op;
  }

  async create(dto: CreateOperationDto): Promise<OperationEntity> {
    const op = this.opRepo.create({
      ...dto,
      starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
      ends_at: dto.ends_at ? new Date(dto.ends_at) : null,
    });
    return this.opRepo.save(op);
  }

  async update(id: number, dto: UpdateOperationDto): Promise<OperationEntity> {
    const op = await this.findById(id);
    const { starts_at, ends_at, ...fields } = dto;
    Object.assign(op, fields);
    if (starts_at !== undefined)
      op.starts_at = starts_at ? new Date(starts_at) : null;
    if (ends_at !== undefined) op.ends_at = ends_at ? new Date(ends_at) : null;
    return this.opRepo.save(op);
  }

  async list(
    query: OperationListQueryDto,
    scope?: { privileged: boolean; hubIds: number[]; userId: number | null },
  ): Promise<Paginated<Record<string, unknown>>> {
    const pagination = normalizePagination(query);
    const qb = this.opRepo.createQueryBuilder('o');
    if (query.status) qb.andWhere('o.status = :s', { s: query.status });
    if (query.ownerUserId)
      qb.andWhere('o.owner_user_id = :u', { u: query.ownerUserId });
    if (query.search)
      qb.andWhere('(o.title ILIKE :q OR o.goal ILIKE :q)', {
        q: `%${query.search}%`,
      });
    // فیلتر بر اساس میکرورسانه — عملیاتی که این رسانه در آن هست
    if (query.microMediaId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM operation_media om WHERE om.operation_id = o.id AND om.micro_media_id = :mmId)`,
        { mmId: query.microMediaId },
      );
    }

    // scope: کاربر غیرفراگیر تنها عملیات‌های خودش یا عملیات‌هایی که رسانه‌ای از
    // هاب‌های او در آن‌ها هست را می‌بیند.
    if (scope && !scope.privileged) {
      if (scope.hubIds.length === 0) {
        qb.andWhere('o.owner_user_id = :scopeUid', {
          scopeUid: scope.userId ?? -1,
        });
      } else {
        qb.andWhere(
          `(o.owner_user_id = :scopeUid OR EXISTS (
             SELECT 1 FROM operation_media om
             JOIN micro_media m ON m.id = om.micro_media_id
             WHERE om.operation_id = o.id AND m.hub_id IN (:...scopeHubIds)
           ))`,
          { scopeUid: scope.userId ?? -1, scopeHubIds: scope.hubIds },
        );
      }
    }

    qb.orderBy('o.created_at', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take);
    const [items, total] = await qb.getManyAndCount();

    const stats = await this.statsForOperationIds(items.map((o) => o.id));
    const ownerIds = [
      ...new Set(items.map((o) => o.owner_user_id).filter((v): v is number => v != null)),
    ];
    const owners = ownerIds.length
      ? await this.userRepo.find({ where: { id: In(ownerIds) } })
      : [];
    const ownerMap = new Map(owners.map((u) => [u.id, u.name]));

    const enriched = items.map((o) => ({
      ...o,
      owner_name: o.owner_user_id ? ownerMap.get(o.owner_user_id) ?? null : null,
      ...(stats.get(o.id) ?? this.emptyStats()),
    }));
    return paginate(enriched, total, pagination);
  }

  private emptyStats() {
    return {
      mediaCount: 0,
      taskCount: 0,
      doneTaskCount: 0,
      outputCount: 0,
      totalViews: 0,
      totalEngagement: 0,
    };
  }

  /** آمار تجمیعی برای فهرستی از عملیات‌ها (بدون N+1). */
  private async statsForOperationIds(
    ids: number[],
  ): Promise<
    Map<
      number,
      {
        mediaCount: number;
        taskCount: number;
        doneTaskCount: number;
        outputCount: number;
        totalViews: number;
        totalEngagement: number;
      }
    >
  > {
    const map = new Map<number, ReturnType<typeof this.emptyStats>>();
    if (ids.length === 0) return map;
    ids.forEach((id) => map.set(id, this.emptyStats()));

    const mediaRows = await this.opMediaRepo
      .createQueryBuilder('m')
      .select('m.operation_id', 'opId')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.operation_id IN (:...ids)', { ids })
      .groupBy('m.operation_id')
      .getRawMany<{ opId: number; cnt: string }>();
    for (const r of mediaRows) map.get(Number(r.opId))!.mediaCount = Number(r.cnt);

    const taskRows = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.operation_id', 'opId')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'done')`, 'done')
      .where('t.operation_id IN (:...ids)', { ids })
      .groupBy('t.operation_id')
      .getRawMany<{ opId: number; cnt: string; done: string }>();
    for (const r of taskRows) {
      const s = map.get(Number(r.opId))!;
      s.taskCount = Number(r.cnt);
      s.doneTaskCount = Number(r.done);
    }

    const outRows = await this.opOutputRepo
      .createQueryBuilder('o')
      .select('o.operation_id', 'opId')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(o.views), 0)', 'views')
      .addSelect('COALESCE(SUM(o.engagement), 0)', 'eng')
      .where('o.operation_id IN (:...ids)', { ids })
      .groupBy('o.operation_id')
      .getRawMany<{ opId: number; cnt: string; views: string; eng: string }>();
    for (const r of outRows) {
      const s = map.get(Number(r.opId))!;
      s.outputCount = Number(r.cnt);
      s.totalViews = Number(r.views);
      s.totalEngagement = Math.round(Number(r.eng) * 10) / 10;
    }

    return map;
  }

  /** جزئیات یک عملیات همراه با نام مالک و آمار تجمیعی (برای GET /campaigns/:id). */
  async getDetail(id: number): Promise<Record<string, unknown>> {
    const op = await this.findById(id);
    const stats = await this.statsForOperationIds([id]);
    let ownerName: string | null = null;
    if (op.owner_user_id) {
      const owner = await this.userRepo.findOne({
        where: { id: op.owner_user_id },
      });
      ownerName = owner?.name ?? null;
    }
    return {
      ...op,
      owner_name: ownerName,
      ...(stats.get(id) ?? this.emptyStats()),
    };
  }

  // --- media ---

  async listMedia(operationId: number): Promise<Record<string, unknown>[]> {
    await this.findById(operationId);
    const links = await this.opMediaRepo.find({
      where: { operation_id: operationId },
      order: { created_at: 'ASC' },
    });
    const ids = links.map((l) => l.micro_media_id);
    const medias = ids.length
      ? await this.mediaRepo.find({ where: { id: In(ids) } })
      : [];
    const mediaMap = new Map(medias.map((m) => [m.id, m]));

    // آمار خروجی هر میکرورسانه در این عملیات.
    const outputs = await this.opOutputRepo.find({
      where: { operation_id: operationId },
    });
    const perMedia = new Map<
      number,
      { outputCount: number; views: number; engagement: number }
    >();
    for (const o of outputs) {
      if (o.micro_media_id == null) continue;
      const agg = perMedia.get(o.micro_media_id) ?? {
        outputCount: 0,
        views: 0,
        engagement: 0,
      };
      agg.outputCount += 1;
      agg.views += o.views ?? 0;
      agg.engagement += o.engagement ?? 0;
      perMedia.set(o.micro_media_id, agg);
    }

    return links.map((l) => {
      const m = mediaMap.get(l.micro_media_id);
      const agg = perMedia.get(l.micro_media_id);
      return {
        ...l,
        micro_media_name: m?.name ?? `#${l.micro_media_id}`,
        activity_domain: m?.activity_domain ?? null,
        importance_level: m?.importance_level ?? null,
        micro_media_status: m?.status ?? null,
        hub_id: m?.hub_id ?? null,
        outputCount: agg?.outputCount ?? 0,
        views: agg?.views ?? 0,
        engagement: agg ? Math.round(agg.engagement * 10) / 10 : 0,
      };
    });
  }

  async addMedia(
    operationId: number,
    dto: AddMediaToOperationDto,
  ): Promise<OperationMediaEntity[]> {
    await this.findById(operationId);
    const result: OperationMediaEntity[] = [];
    for (const mediaId of dto.micro_media_ids) {
      const existing = await this.opMediaRepo.findOne({
        where: { operation_id: operationId, micro_media_id: mediaId },
      });
      if (existing) {
        result.push(existing);
        continue;
      }
      const link = this.opMediaRepo.create({
        operation_id: operationId,
        micro_media_id: mediaId,
        planned_action: dto.planned_action ?? null,
        expected_output: dto.expected_output ?? null,
        status: 'selected',
      });
      result.push(await this.opMediaRepo.save(link));
    }
    return result;
  }

  // --- tasks (delegate به TasksService) ---

  async listTasks(operationId: number) {
    await this.findById(operationId);
    const query = new TaskListQueryDto();
    query.operationId = operationId;
    query.page = 1;
    query.pageSize = 100;
    return this.tasksService.list(query);
  }

  async createTask(operationId: number, dto: CreateOperationTaskDto) {
    await this.findById(operationId);
    return this.tasksService.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      assignee_user_id: dto.assignee_user_id,
      micro_media_id: dto.micro_media_id,
      operation_id: operationId,
      due_date: dto.due_date,
      tags: dto.tags,
    });
  }

  // --- outputs ---

  async listOutputs(operationId: number): Promise<Record<string, unknown>[]> {
    await this.findById(operationId);
    const outputs = await this.opOutputRepo.find({
      where: { operation_id: operationId },
      order: { created_at: 'DESC' },
    });
    const ids = [
      ...new Set(
        outputs
          .map((o) => o.micro_media_id)
          .filter((v): v is number => v != null),
      ),
    ];
    const medias = ids.length
      ? await this.mediaRepo.find({ where: { id: In(ids) } })
      : [];
    const mediaMap = new Map(medias.map((m) => [m.id, m.name]));
    return outputs.map((o) => ({
      ...o,
      micro_media_name: o.micro_media_id
        ? mediaMap.get(o.micro_media_id) ?? `#${o.micro_media_id}`
        : null,
    }));
  }

  async addOutput(
    operationId: number,
    dto: CreateOperationOutputDto,
  ): Promise<OperationOutputEntity> {
    await this.findById(operationId);
    const output = this.opOutputRepo.create({
      operation_id: operationId,
      micro_media_id: dto.micro_media_id ?? null,
      page_id: dto.page_id ?? null,
      task_id: dto.task_id ?? null,
      output_type: dto.output_type ?? 'other',
      output_url: dto.output_url ?? null,
      description: dto.description ?? null,
      published_at: dto.published_at ? new Date(dto.published_at) : null,
      views: dto.views ?? null,
      likes: dto.likes ?? null,
      comments: dto.comments ?? null,
      shares: dto.shares ?? null,
      engagement: dto.engagement ?? null,
      captured_at: new Date(),
      source: 'manual',
      created_by_user_id: dto.created_by_user_id ?? null,
    });
    return this.opOutputRepo.save(output);
  }

  /**
   * گزارش اثرسنجی جامع عملیات (design §7.10): آمار کلی، تفکیک خروجی بر اساس نوع،
   * عملکرد هر میکرورسانه (بازدید/تعامل/تعداد خروجی) و رسانه‌های بدون خروجی.
   */
  async impactReport(operationId: number): Promise<Record<string, unknown>> {
    const op = await this.findById(operationId);
    const links = await this.opMediaRepo.find({
      where: { operation_id: operationId },
    });
    const outputs = await this.opOutputRepo.find({
      where: { operation_id: operationId },
    });
    const tasks = await this.taskRepo.find({
      where: { operation_id: operationId },
    });

    const mediaIds = [
      ...new Set([
        ...links.map((l) => l.micro_media_id),
        ...outputs
          .map((o) => o.micro_media_id)
          .filter((v): v is number => v != null),
      ]),
    ];
    const medias = mediaIds.length
      ? await this.mediaRepo.find({ where: { id: In(mediaIds) } })
      : [];
    const mediaMap = new Map(medias.map((m) => [m.id, m.name]));

    const totalViews = outputs.reduce((s, o) => s + (o.views ?? 0), 0);
    const totalLikes = outputs.reduce((s, o) => s + (o.likes ?? 0), 0);
    const totalComments = outputs.reduce((s, o) => s + (o.comments ?? 0), 0);
    const totalShares = outputs.reduce((s, o) => s + (o.shares ?? 0), 0);
    const totalEngagement = outputs.reduce(
      (s, o) => s + (o.engagement ?? 0),
      0,
    );

    // تفکیک خروجی بر اساس نوع.
    const byType = new Map<string, number>();
    for (const o of outputs) {
      byType.set(o.output_type, (byType.get(o.output_type) ?? 0) + 1);
    }

    // عملکرد هر میکرورسانه.
    const perMedia = new Map<
      number,
      { outputCount: number; views: number; engagement: number }
    >();
    for (const o of outputs) {
      if (o.micro_media_id == null) continue;
      const agg = perMedia.get(o.micro_media_id) ?? {
        outputCount: 0,
        views: 0,
        engagement: 0,
      };
      agg.outputCount += 1;
      agg.views += o.views ?? 0;
      agg.engagement += o.engagement ?? 0;
      perMedia.set(o.micro_media_id, agg);
    }
    const mediaPerformance = [...perMedia.entries()]
      .map(([mid, agg]) => ({
        micro_media_id: mid,
        name: mediaMap.get(mid) ?? `#${mid}`,
        outputCount: agg.outputCount,
        views: agg.views,
        engagement: Math.round(agg.engagement * 10) / 10,
      }))
      .sort((a, b) => b.views - a.views);

    // رسانه‌های انتخاب‌شده بدون هیچ خروجی.
    const withOutput = new Set(perMedia.keys());
    const mediaWithoutOutput = links
      .filter((l) => !withOutput.has(l.micro_media_id))
      .map((l) => ({
        micro_media_id: l.micro_media_id,
        name: mediaMap.get(l.micro_media_id) ?? `#${l.micro_media_id}`,
      }));

    const engagementRate =
      totalViews > 0
        ? Math.round((totalEngagement / totalViews) * 1000) / 10
        : 0;

    return {
      operation_id: operationId,
      title: op.title,
      status: op.status,
      starts_at: op.starts_at,
      ends_at: op.ends_at,
      selectedMediaCount: links.length,
      activeMediaCount: withOutput.size,
      assignedTaskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.status === 'done').length,
      outputCount: outputs.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalEngagement: Math.round(totalEngagement * 10) / 10,
      engagementRate,
      outputsByType: [...byType.entries()].map(([type, count]) => ({
        type,
        count,
      })),
      mediaPerformance,
      mediaWithoutOutput,
    };
  }
}
