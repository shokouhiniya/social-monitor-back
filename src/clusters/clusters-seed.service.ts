import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Cluster } from '../modules/cluster/cluster.entity';
import { Page } from '../modules/page/page.entity';
import { TOPICAL_CLUSTERS } from '../modules/page/page.constants';

/** پالت رنگ پیش‌فرض برای خوشه‌های seed‌شده. */
const SEED_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
  '#00838f', '#4e342e', '#283593', '#558b2f', '#ad1457',
  '#0097a7', '#6a1b9a', '#ef6c00', '#2e7d32', '#d84315',
  '#1565c0', '#4527a0', '#ff8f00', '#00695c', '#c2185b',
  '#5d4037', '#37474f', '#827717', '#880e4f', '#01579b',
];

/**
 * سرویس seed خوشه‌ها در ساختار جدید ClustersModule (design §5.4).
 *
 * **تصمیم مرزی (Requirement 1.6 — گذار غیرتخریبی):** برخلاف نسخهٔ legacy
 * (`modules/cluster/cluster-seed.service.ts`) که `OnModuleInit` را پیاده می‌کند
 * و هنگام بالا آمدن برنامه به‌صورت خودکار اجرا می‌شود، این سرویس عمداً
 * `OnModuleInit` را پیاده **نمی‌کند**. دلیل: در دورهٔ گذار، ماژول legacy
 * `ClusterModule` همچنان ثبت و فعال است و seed خودکار را انجام می‌دهد؛ اجرای
 * هم‌زمان دو seed خودکار روی همان جدول `clusters` کار تکراری است. بنابراین منطق
 * seed به ساختار جدید «منتقل» شده و به‌صورت متد عمومی idempotent (`seed()`) در
 * دسترس است، اما تا کنارگذاری ماژول legacy فراخوانی خودکار نمی‌شود. خود متد نیز
 * idempotent است (در صورت وجود خوشه، seed را رد می‌کند) تا اجرای دستی امن باشد.
 */
@Injectable()
export class ClustersSeedService {
  private readonly logger = new Logger(ClustersSeedService.name);

  constructor(
    @InjectRepository(Cluster)
    private readonly clusterRepository: Repository<Cluster>,
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  /**
   * seed کامل و idempotent: ساخت خوشه‌ها از `TOPICAL_CLUSTERS` (در صورت خالی
   * بودن جدول) و سپس اختصاص خودکار منابعِ دارای `category` اما بدون `cluster_id`.
   */
  async seed(): Promise<{ seeded: number; assigned: number }> {
    const seeded = await this.seedClusters();
    const assigned = await this.autoAssignSources();
    return { seeded, assigned };
  }

  /**
   * اگر جدول خوشه‌ها خالی باشد، یک خوشه به‌ازای هر مدخل `TOPICAL_CLUSTERS` می‌سازد.
   * تعداد خوشه‌های ساخته‌شده را برمی‌گرداند (۰ اگر از قبل seed شده باشد).
   */
  private async seedClusters(): Promise<number> {
    const count = await this.clusterRepository.count();
    if (count > 0) {
      this.logger.log(`✅ ${count} clusters already exist — skipping seed`);
      return 0;
    }

    this.logger.log('🌱 Seeding clusters from TOPICAL_CLUSTERS...');

    let idx = 0;
    for (const value of Object.values(TOPICAL_CLUSTERS)) {
      const cluster = this.clusterRepository.create({
        name: value.label,
        description: value.description,
        color: SEED_COLORS[idx % SEED_COLORS.length],
      });
      await this.clusterRepository.save(cluster);
      idx++;
    }

    this.logger.log(`✅ Seeded ${idx} clusters`);
    return idx;
  }

  /**
   * برای منابعی که `category` دارند اما `cluster_id` ندارند، خوشهٔ منطبق را با
   * label پیدا کرده و آن‌ها را اختصاص می‌دهد. تعداد منابعِ اختصاص‌یافته را
   * برمی‌گرداند.
   */
  private async autoAssignSources(): Promise<number> {
    const allClusters = await this.clusterRepository.find();
    if (allClusters.length === 0) return 0;

    // label خوشه → cluster.id
    const labelToClusterId = new Map<string, number>();
    for (const cluster of allClusters) {
      labelToClusterId.set(cluster.name, cluster.id);
    }

    // کلید category → cluster.id (از طریق TOPICAL_CLUSTERS)
    const keyToClusterId = new Map<string, number>();
    for (const [key, value] of Object.entries(TOPICAL_CLUSTERS)) {
      const clusterId = labelToClusterId.get(value.label);
      if (clusterId) {
        keyToClusterId.set(key, clusterId);
      }
    }

    const unassigned = await this.pageRepository.find({
      where: { cluster_id: IsNull() },
    });

    if (unassigned.length === 0) {
      this.logger.log('✅ All sources already have cluster assignments');
      return 0;
    }

    let assigned = 0;
    for (const page of unassigned) {
      if (!page.category) continue;
      const clusterId = keyToClusterId.get(page.category);
      if (clusterId) {
        page.cluster_id = clusterId;
        await this.pageRepository.save(page);
        assigned++;
      }
    }

    if (assigned > 0) {
      this.logger.log(
        `✅ Auto-assigned ${assigned} sources to clusters (${unassigned.length - assigned} had no matching category)`,
      );
    }
    return assigned;
  }
}
