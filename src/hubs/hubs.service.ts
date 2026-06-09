import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HubEntity } from './hub.entity';
import { HubUserEntity } from './hub-user.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { TaskEntity } from '../tasks/task.entity';
import { Interaction } from '../modules/interaction/interaction.entity';
import { User } from '../modules/user/user.entity';
import { AssignHubUserDto, CreateHubDto, UpdateHubDto } from './hubs.dto';
import { DomainException, ERROR_CODES } from '../common/exceptions';

/** بازهٔ پیش‌فرض «تعامل اخیر» برای محاسبهٔ فعال بودن: ۶ ماه. */
const RECENT_INTERACTION_MONTHS = 6;

/**
 * سرویس مدیریت هاب‌ها و رابطهٔ کاربر↔هاب (design §3.1، §6).
 *
 * `HubScopeGuard` فاز ۵ از `listHubIdsForUser` برای تعیین محدودهٔ دسترسی کاربر
 * استفاده می‌کند.
 */
@Injectable()
export class HubsService {
  constructor(
    @InjectRepository(HubEntity)
    private readonly hubRepo: Repository<HubEntity>,
    @InjectRepository(HubUserEntity)
    private readonly hubUserRepo: Repository<HubUserEntity>,
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(Interaction)
    private readonly interactionRepo: Repository<Interaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(scope?: {
    privileged: boolean;
    hubIds: number[];
  }): Promise<HubEntity[]> {
    const all = await this.hubRepo.find({ order: { created_at: 'ASC' } });
    if (scope && !scope.privileged) {
      const allowed = new Set(scope.hubIds);
      return all.filter((h) => allowed.has(h.id));
    }
    return all;
  }

  /**
   * فهرست هاب‌ها همراه با آمار مدیریتی per-hub (design §8): تعداد میکرورسانه،
   * تعداد فعال (دارای تعامل در ۶ ماه اخیر)، تعداد تسک باز، نام مدیر و کارشناسان.
   * با چند query تجمیعی (نه N+1) محاسبه می‌شود.
   */
  async listWithStats(scope?: {
    privileged: boolean;
    hubIds: number[];
  }): Promise<
    Array<
      HubEntity & {
        manager_name: string | null;
        total_media: number;
        active_media: number;
        open_tasks: number;
        member_count: number;
      }
    >
  > {
    const allHubs = await this.hubRepo.find({ order: { created_at: 'ASC' } });
    const hubs =
      scope && !scope.privileged
        ? allHubs.filter((h) => new Set(scope.hubIds).has(h.id))
        : allHubs;
    if (hubs.length === 0) return [];

    const since = new Date();
    since.setMonth(since.getMonth() - RECENT_INTERACTION_MONTHS);

    // تعداد کل میکرورسانه per hub.
    const totalRows = await this.mediaRepo
      .createQueryBuilder('m')
      .select('m.hub_id', 'hub_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.hub_id IS NOT NULL')
      .groupBy('m.hub_id')
      .getRawMany<{ hub_id: number; cnt: string }>();
    const totalMap = new Map(totalRows.map((r) => [Number(r.hub_id), Number(r.cnt)]));

    // تعداد فعال (دارای تعامل اخیر) per hub.
    const activeRows = await this.mediaRepo
      .createQueryBuilder('m')
      .select('m.hub_id', 'hub_id')
      .addSelect('COUNT(DISTINCT m.id)', 'cnt')
      .innerJoin(
        'interactions',
        'i',
        'i.micro_media_id = m.id AND i.interaction_date >= :since',
        { since },
      )
      .where('m.hub_id IS NOT NULL')
      .groupBy('m.hub_id')
      .getRawMany<{ hub_id: number; cnt: string }>();
    const activeMap = new Map(activeRows.map((r) => [Number(r.hub_id), Number(r.cnt)]));

    // تعداد تسک باز per hub.
    const taskRows = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.hub_id', 'hub_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('t.hub_id IS NOT NULL')
      .andWhere("t.status = 'open'")
      .groupBy('t.hub_id')
      .getRawMany<{ hub_id: number; cnt: string }>();
    const taskMap = new Map(taskRows.map((r) => [Number(r.hub_id), Number(r.cnt)]));

    // تعداد اعضا per hub.
    const memberRows = await this.hubUserRepo
      .createQueryBuilder('hu')
      .select('hu.hub_id', 'hub_id')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('hu.hub_id')
      .getRawMany<{ hub_id: number; cnt: string }>();
    const memberMap = new Map(memberRows.map((r) => [Number(r.hub_id), Number(r.cnt)]));

    // نام مدیران.
    const managerIds = hubs.map((h) => h.manager_user_id).filter((v): v is number => v != null);
    const managers = managerIds.length
      ? await this.userRepo.findByIds(managerIds)
      : [];
    const managerMap = new Map(managers.map((u) => [u.id, u.name]));

    return hubs.map((h) => ({
      ...h,
      manager_name: h.manager_user_id ? managerMap.get(h.manager_user_id) ?? null : null,
      total_media: totalMap.get(h.id) ?? 0,
      active_media: activeMap.get(h.id) ?? 0,
      open_tasks: taskMap.get(h.id) ?? 0,
      member_count: memberMap.get(h.id) ?? 0,
    }));
  }

  async findById(id: number): Promise<HubEntity> {
    const hub = await this.hubRepo.findOne({ where: { id } });
    if (!hub) {
      throw new DomainException(
        ERROR_CODES.HUB_NOT_FOUND,
        `هابی با شناسهٔ ${id} یافت نشد`,
      );
    }
    return hub;
  }

  async create(dto: CreateHubDto): Promise<HubEntity> {
    const hub = this.hubRepo.create(dto);
    return this.hubRepo.save(hub);
  }

  async update(id: number, dto: UpdateHubDto): Promise<HubEntity> {
    const hub = await this.findById(id);
    Object.assign(hub, dto);
    return this.hubRepo.save(hub);
  }

  // --- رابطهٔ کاربر↔هاب ---

  async listUsers(hubId: number): Promise<HubUserEntity[]> {
    await this.findById(hubId);
    return this.hubUserRepo.find({ where: { hub_id: hubId } });
  }

  async assignUser(
    hubId: number,
    dto: AssignHubUserDto,
  ): Promise<HubUserEntity> {
    await this.findById(hubId);
    const existing = await this.hubUserRepo.findOne({
      where: { hub_id: hubId, user_id: dto.user_id },
    });
    if (existing) {
      existing.role_in_hub = dto.role_in_hub ?? existing.role_in_hub;
      return this.hubUserRepo.save(existing);
    }
    const link = this.hubUserRepo.create({
      hub_id: hubId,
      user_id: dto.user_id,
      role_in_hub: dto.role_in_hub ?? null,
    });
    return this.hubUserRepo.save(link);
  }

  async removeUser(hubId: number, userId: number): Promise<{ removed: boolean }> {
    const res = await this.hubUserRepo.delete({
      hub_id: hubId,
      user_id: userId,
    });
    return { removed: (res.affected ?? 0) > 0 };
  }

  /** فهرست شناسهٔ هاب‌هایی که کاربر در آن‌ها نقش دارد (برای HubScopeGuard). */
  async listHubIdsForUser(userId: number): Promise<number[]> {
    const links = await this.hubUserRepo.find({ where: { user_id: userId } });
    return links.map((l) => l.hub_id);
  }

  /** فهرست امن کاربران برای انتخاب مدیر هاب / تخصیص عضو (بدون password_hash). */
  async listAssignableUsers(): Promise<
    Array<{ id: number; name: string; username: string | null; role: string }>
  > {
    const users = await this.userRepo.find({ order: { id: 'ASC' } });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username ?? null,
      role: u.role,
    }));
  }
}
