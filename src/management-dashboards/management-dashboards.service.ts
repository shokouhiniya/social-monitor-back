import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { MediaScoreRecordEntity } from '../media-score/media-score-record.entity';
import { HubEntity } from '../hubs/hub.entity';
import { OperationEntity } from '../campaigns/operation.entity';
import { OperationMediaEntity } from '../campaigns/operation-media.entity';
import { OperationOutputEntity } from '../campaigns/operation-output.entity';
import { TaskEntity } from '../tasks/task.entity';
import { Interaction } from '../modules/interaction/interaction.entity';
import { DomainException, ERROR_CODES } from '../common/exceptions';

/**
 * سرویس داشبوردهای مدیریتی (design §4، plan §6.7). فقط‌خواندنی و تجمیعی.
 *
 * این سرویس به سؤالات مدیریتی PRD پاسخ می‌دهد: رسانه‌های بدون تعامل ۶ ماه،
 * بدون score، بدون هاب، عملیات فعال، تسک‌های باز/عقب‌افتاده، اثرسنجی عملیات.
 */
@Injectable()
export class ManagementDashboardsService {
  constructor(
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(MediaScoreRecordEntity)
    private readonly scoreRepo: Repository<MediaScoreRecordEntity>,
    @InjectRepository(HubEntity)
    private readonly hubRepo: Repository<HubEntity>,
    @InjectRepository(OperationEntity)
    private readonly opRepo: Repository<OperationEntity>,
    @InjectRepository(OperationMediaEntity)
    private readonly opMediaRepo: Repository<OperationMediaEntity>,
    @InjectRepository(OperationOutputEntity)
    private readonly opOutputRepo: Repository<OperationOutputEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(Interaction)
    private readonly interactionRepo: Repository<Interaction>,
  ) {}

  private monthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }

  /** شناسهٔ میکرورسانه‌هایی که از `since` به بعد تعامل داشته‌اند. */
  private async activeMediaIdsSince(since: Date): Promise<Set<number>> {
    const rows = await this.interactionRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.micro_media_id', 'mid')
      .where('i.micro_media_id IS NOT NULL')
      .andWhere('i.interaction_date >= :since', { since })
      .getRawMany<{ mid: number }>();
    return new Set(rows.map((r) => r.mid).filter((v) => v != null));
  }

  /** داشبورد کلان مدیریت (GET /dashboards/management). */
  async management(): Promise<Record<string, unknown>> {
    const sixMonthsAgo = this.monthsAgo(6);

    const totalMicroMedia = await this.mediaRepo.count();
    const allMedia = await this.mediaRepo.find({ select: { id: true, hub_id: true } });
    const activeIds = await this.activeMediaIdsSince(sixMonthsAgo);

    const microMediaWithRecentInteraction = allMedia.filter((m) =>
      activeIds.has(m.id),
    ).length;
    const microMediaWithoutInteractionInLast6Months =
      totalMicroMedia - microMediaWithRecentInteraction;
    const microMediaWithoutHub = allMedia.filter((m) => m.hub_id == null).length;

    // رسانه‌های بدون هیچ رکورد امتیاز
    const scoredRows = await this.scoreRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.micro_media_id', 'mid')
      .getRawMany<{ mid: number }>();
    const scoredSet = new Set(scoredRows.map((r) => r.mid));
    const microMediaWithoutScore = allMedia.filter(
      (m) => !scoredSet.has(m.id),
    ).length;

    const activeOperations = await this.opRepo.count({
      where: { status: 'active' },
    });
    const openTasks = await this.taskRepo.count({ where: { status: 'open' } });

    // تسک‌های عقب‌افتاده: due_date گذشته و وضعیت غیر done/cancelled
    const overdueTasks = await this.taskRepo
      .createQueryBuilder('t')
      .where('t.due_date IS NOT NULL')
      .andWhere('t.due_date < now()')
      .andWhere("t.status NOT IN ('done', 'cancelled')")
      .getCount();

    // پوشش هاب: تعداد رسانه و رسانهٔ فعال به‌ازای هر هاب
    const hubs = await this.hubRepo.find();
    const hubCoverageSummary = hubs.map((h) => {
      const mediaOfHub = allMedia.filter((m) => m.hub_id === h.id);
      const activeOfHub = mediaOfHub.filter((m) => activeIds.has(m.id)).length;
      return {
        hub_id: h.id,
        hub_name: h.name,
        total: mediaOfHub.length,
        active: activeOfHub,
      };
    });
    const topHubsByActiveMedia = [...hubCoverageSummary]
      .sort((a, b) => b.active - a.active)
      .slice(0, 5);

    // حوزه‌های ضعیف: حوزه‌هایی با بیشترین رسانهٔ بدون تعامل اخیر
    const domainMap = new Map<string, number>();
    const allMediaFull = await this.mediaRepo.find({
      select: { id: true, activity_domain: true },
    });
    for (const m of allMediaFull) {
      if (!activeIds.has(m.id) && m.activity_domain) {
        domainMap.set(
          m.activity_domain,
          (domainMap.get(m.activity_domain) ?? 0) + 1,
        );
      }
    }
    const weakDomains = Array.from(domainMap.entries())
      .map(([domain, inactiveCount]) => ({ domain, inactiveCount }))
      .sort((a, b) => b.inactiveCount - a.inactiveCount)
      .slice(0, 5);

    const recentInteractions = await this.interactionRepo.find({
      where: {},
      order: { interaction_date: 'DESC' },
      take: 10,
    });

    return {
      totalMicroMedia,
      microMediaWithRecentInteraction,
      microMediaWithoutInteractionInLast6Months,
      microMediaWithoutScore,
      microMediaWithoutHub,
      activeOperations,
      openTasks,
      overdueTasks,
      hubCoverageSummary,
      topHubsByActiveMedia,
      weakDomains,
      recentInteractions,
    };
  }

  /** داشبورد یک هاب (GET /dashboards/hubs/:hubId). */
  async hub(hubId: number): Promise<Record<string, unknown>> {
    const hub = await this.hubRepo.findOne({ where: { id: hubId } });
    if (!hub) {
      throw new DomainException(
        ERROR_CODES.HUB_NOT_FOUND,
        `هابی با شناسهٔ ${hubId} یافت نشد`,
      );
    }
    const sixMonthsAgo = this.monthsAgo(6);
    const activeIds = await this.activeMediaIdsSince(sixMonthsAgo);
    const media = await this.mediaRepo.find({
      where: { hub_id: hubId },
      select: { id: true },
    });
    const ids = media.map((m) => m.id);
    const activeMicroMedia = ids.filter((id) => activeIds.has(id)).length;

    const openTasks = await this.taskRepo.count({
      where: { hub_id: hubId, status: 'open' },
    });
    const completedTasks = await this.taskRepo.count({
      where: { hub_id: hubId, status: 'done' },
    });

    return {
      hub_id: hubId,
      hub_name: hub.name,
      totalMicroMedia: ids.length,
      activeMicroMedia,
      inactiveMicroMedia: ids.length - activeMicroMedia,
      openTasks,
      completedTasks,
    };
  }

  /** داشبورد اثرسنجی یک عملیات (GET /dashboards/campaigns/:id). */
  async operation(operationId: number): Promise<Record<string, unknown>> {
    const op = await this.opRepo.findOne({ where: { id: operationId } });
    if (!op) {
      throw new DomainException(
        ERROR_CODES.OPERATION_NOT_FOUND,
        `عملیاتی با شناسهٔ ${operationId} یافت نشد`,
      );
    }
    const selectedMedia = await this.opMediaRepo.find({
      where: { operation_id: operationId },
    });
    const outputs = await this.opOutputRepo.find({
      where: { operation_id: operationId },
    });
    const tasks = await this.taskRepo.find({
      where: { operation_id: operationId },
    });

    const totalViews = outputs.reduce((s, o) => s + (o.views ?? 0), 0);
    const totalEngagement = outputs.reduce(
      (s, o) => s + (o.engagement ?? 0),
      0,
    );

    // خروجی بر اساس platform (از output_type به‌عنوان جایگزین ساده)
    const outputsByType = new Map<string, number>();
    for (const o of outputs) {
      outputsByType.set(o.output_type, (outputsByType.get(o.output_type) ?? 0) + 1);
    }

    // رسانه‌های بدون خروجی
    const mediaWithOutput = new Set(
      outputs.map((o) => o.micro_media_id).filter((v) => v != null),
    );
    const mediaWithoutOutput = selectedMedia
      .map((m) => m.micro_media_id)
      .filter((id) => !mediaWithOutput.has(id));

    return {
      operation_id: operationId,
      title: op.title,
      selectedMediaCount: selectedMedia.length,
      assignedTaskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.status === 'done').length,
      publishedOutputCount: outputs.length,
      totalViews,
      totalEngagement,
      outputsByType: Array.from(outputsByType.entries()).map(([type, count]) => ({
        type,
        count,
      })),
      mediaWithoutOutput,
    };
  }
}
