import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TaskEntity } from './task.entity';
import { TaskTagEntity } from './task-tag.entity';
import { HubEntity } from '../hubs/hub.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { OperationEntity } from '../campaigns/operation.entity';
import { User } from '../modules/user/user.entity';
import {
  ChangeTaskStatusDto,
  CreateTaskDto,
  TaskListQueryDto,
  UpdateTaskDto,
} from './tasks.dto';
import { normalizePagination, paginate, Paginated } from '../common/pagination';
import { DomainException, ERROR_CODES } from '../common/exceptions';

const VALID_STATUSES = ['open', 'in_progress', 'done', 'cancelled'];

export type EnrichedTask = TaskEntity & {
  tags: string[];
  hub_name: string | null;
  micro_media_name: string | null;
  operation_title: string | null;
  assignee_name: string | null;
};

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskTagEntity)
    private readonly tagRepo: Repository<TaskTagEntity>,
    @InjectRepository(HubEntity)
    private readonly hubRepo: Repository<HubEntity>,
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(OperationEntity)
    private readonly opRepo: Repository<OperationEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: number): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) {
      throw new DomainException(
        ERROR_CODES.TASK_NOT_FOUND,
        `تسکی با شناسهٔ ${id} یافت نشد`,
      );
    }
    return task;
  }

  /**
   * ساخت تسک. اعتبارسنجی scope (Correctness Property 4): حداقل یکی از
   * micro_media_id/hub_id/cluster_id/operation_id باید موجود باشد.
   */
  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    this.assertHasScope(dto);
    const { tags, due_date, ...fields } = dto;
    const task = this.taskRepo.create({
      ...fields,
      due_date: due_date ? new Date(due_date) : null,
    });
    const saved = await this.taskRepo.save(task);
    if (tags?.length) {
      await this.setTags(saved.id, tags);
    }
    return saved;
  }

  async update(id: number, dto: UpdateTaskDto): Promise<TaskEntity> {
    const task = await this.findById(id);
    const { due_date, ...fields } = dto;
    Object.assign(task, fields);
    if (due_date !== undefined) {
      task.due_date = due_date ? new Date(due_date) : null;
    }
    return this.taskRepo.save(task);
  }

  async changeStatus(
    id: number,
    dto: ChangeTaskStatusDto,
  ): Promise<TaskEntity> {
    if (!VALID_STATUSES.includes(dto.status)) {
      throw new DomainException(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `وضعیت نامعتبر: ${dto.status}`,
      );
    }
    const task = await this.findById(id);
    task.status = dto.status;
    task.completed_at = dto.status === 'done' ? new Date() : null;
    return this.taskRepo.save(task);
  }

  async list(
    query: TaskListQueryDto,
    scope?: { privileged: boolean; hubIds: number[] },
  ): Promise<Paginated<EnrichedTask>> {
    const pagination = normalizePagination(query);
    const qb = this.taskRepo.createQueryBuilder('t');

    // فیلتر scope هاب (Correctness Property 5) — با AUTH_ENFORCE خاموش بی‌اثر است.
    if (scope && !scope.privileged) {
      if (scope.hubIds.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('t.hub_id IN (:...scopeHubIds)', {
          scopeHubIds: scope.hubIds,
        });
      }
    }

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority)
      qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.assigneeUserId)
      qb.andWhere('t.assignee_user_id = :a', { a: query.assigneeUserId });
    if (query.hubId) qb.andWhere('t.hub_id = :h', { h: query.hubId });
    if (query.microMediaId)
      qb.andWhere('t.micro_media_id = :m', { m: query.microMediaId });
    if (query.operationId)
      qb.andWhere('t.operation_id = :o', { o: query.operationId });
    if (query.clusterId)
      qb.andWhere('t.cluster_id = :c', { c: query.clusterId });
    if (query.search)
      qb.andWhere('(t.title ILIKE :s OR t.description ILIKE :s)', {
        s: `%${query.search}%`,
      });
    if (query.dueBefore)
      qb.andWhere('t.due_date <= :db', { db: query.dueBefore });
    if (query.dueAfter)
      qb.andWhere('t.due_date >= :da', { da: query.dueAfter });
    if (query.overdue === 'true')
      qb.andWhere('t.due_date < now()').andWhere(
        "t.status NOT IN ('done', 'cancelled')",
      );
    if (query.tag)
      qb.andWhere(
        'EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag = :tag)',
        { tag: query.tag },
      );

    qb.orderBy('t.created_at', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    const withTags = await this.attachTags(items);
    const enriched = await this.attachContextNames(withTags);
    return paginate(enriched, total, pagination);
  }

  /** خلاصهٔ آماری تسک‌ها برای کارت‌های بالای صفحه (با اعمال scope هاب). */
  async overview(scope?: {
    privileged: boolean;
    hubIds: number[];
  }): Promise<Record<string, number>> {
    const qb = this.taskRepo.createQueryBuilder('t');
    if (scope && !scope.privileged) {
      if (scope.hubIds.length === 0) {
        qb.where('1 = 0');
      } else {
        qb.where('t.hub_id IN (:...ids)', { ids: scope.hubIds });
      }
    }
    const tasks = await qb.getMany();
    const now = Date.now();
    const overview: Record<string, number> = {
      total: tasks.length,
      open: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
      overdue: 0,
    };
    for (const t of tasks) {
      if (overview[t.status] !== undefined) overview[t.status] += 1;
      if (
        t.due_date &&
        new Date(t.due_date).getTime() < now &&
        t.status !== 'done' &&
        t.status !== 'cancelled'
      ) {
        overview.overdue += 1;
      }
    }
    return overview;
  }

  // --- tags ---
  async getTags(taskId: number): Promise<string[]> {
    const rows = await this.tagRepo.find({ where: { task_id: taskId } });
    return rows.map((r) => r.tag);
  }

  async setTags(taskId: number, tags: string[]): Promise<string[]> {
    await this.findById(taskId);
    await this.tagRepo.delete({ task_id: taskId });
    const unique = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
    if (unique.length) {
      await this.tagRepo.save(
        unique.map((tag) => this.tagRepo.create({ task_id: taskId, tag })),
      );
    }
    return unique;
  }

  // --- helpers ---
  private assertHasScope(dto: CreateTaskDto): void {
    if (
      dto.micro_media_id == null &&
      dto.hub_id == null &&
      dto.cluster_id == null &&
      dto.operation_id == null
    ) {
      throw new DomainException(
        ERROR_CODES.INVALID_TASK_SCOPE,
        'تسک باید حداقل به یکی از این‌ها متصل باشد: میکرورسانه، هاب، خوشه یا عملیات',
      );
    }
  }

  private async attachTags(
    items: TaskEntity[],
  ): Promise<Array<TaskEntity & { tags: string[] }>> {
    if (items.length === 0) return [];
    const ids = items.map((t) => t.id);
    const tagRows = await this.tagRepo.find({ where: { task_id: In(ids) } });
    const byTask = new Map<number, string[]>();
    for (const t of tagRows) {
      const arr = byTask.get(t.task_id) ?? [];
      arr.push(t.tag);
      byTask.set(t.task_id, arr);
    }
    return items.map((t) => ({ ...t, tags: byTask.get(t.id) ?? [] }));
  }

  /** افزودن نام context‌ها (هاب/میکرورسانه/عملیات) و نام مسئول به تسک‌ها. */
  private async attachContextNames(
    items: Array<TaskEntity & { tags: string[] }>,
  ): Promise<EnrichedTask[]> {
    if (items.length === 0) return [];

    const hubIds = [...new Set(items.map((t) => t.hub_id).filter((v): v is number => v != null))];
    const mediaIds = [...new Set(items.map((t) => t.micro_media_id).filter((v): v is number => v != null))];
    const opIds = [...new Set(items.map((t) => t.operation_id).filter((v): v is number => v != null))];
    const userIds = [...new Set(items.map((t) => t.assignee_user_id).filter((v): v is number => v != null))];

    const [hubs, medias, ops, users] = await Promise.all([
      hubIds.length
        ? this.hubRepo.find({ where: { id: In(hubIds) } })
        : Promise.resolve<HubEntity[]>([]),
      mediaIds.length
        ? this.mediaRepo.find({ where: { id: In(mediaIds) } })
        : Promise.resolve<MicroMediaEntity[]>([]),
      opIds.length
        ? this.opRepo.find({ where: { id: In(opIds) } })
        : Promise.resolve<OperationEntity[]>([]),
      userIds.length
        ? this.userRepo.find({ where: { id: In(userIds) } })
        : Promise.resolve<User[]>([]),
    ]);

    const hubMap = new Map<number, string>(hubs.map((h) => [h.id, h.name]));
    const mediaMap = new Map<number, string>(medias.map((m) => [m.id, m.name]));
    const opMap = new Map<number, string>(ops.map((o) => [o.id, o.title]));
    const userMap = new Map<number, string>(users.map((u) => [u.id, u.name]));

    return items.map((t) => ({
      ...t,
      hub_name: t.hub_id ? hubMap.get(t.hub_id) ?? null : null,
      micro_media_name: t.micro_media_id ? mediaMap.get(t.micro_media_id) ?? null : null,
      operation_title: t.operation_id ? opMap.get(t.operation_id) ?? null : null,
      assignee_name: t.assignee_user_id ? userMap.get(t.assignee_user_id) ?? null : null,
    }));
  }
}
