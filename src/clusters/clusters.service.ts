import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cluster } from '../modules/cluster/cluster.entity';
import { Page } from '../modules/page/page.entity';
import { ConflictException, NotFoundException } from '../common/exceptions';
import {
  ClusterBulkResult,
  ClusterDetail,
  ClusterWithStats,
} from './cluster.types';
import {
  AssignSourcesDto,
  CreateClusterDto,
  SetRepresentativesDto,
  ToggleRepresentativeDto,
  UpdateClusterDto,
} from './clusters.dto';

/**
 * سرویس هستهٔ مدیریت خوشه‌ها (ClustersModule — design §5.4).
 *
 * **مرز تمیز (Requirement 1.1, 1.2):** خوشه روی همان جدول `clusters` و توزیع
 * منابع روی همان جدول `pages` نگاشت می‌شود. این سرویس به جای وابستگی به
 * `SourcesService`، مستقیماً از `Repository<Page>` استفاده می‌کند
 * (`TypeOrmModule.forFeature([Cluster, Page])`). به این ترتیب هیچ وابستگی
 * متقابل (mutual/circular) با `SourcesModule` ایجاد نمی‌شود و نیازی به
 * `forwardRef` نیست — گراف وابستگی بدون‌دور (acyclic) می‌ماند (Requirement 1.2).
 *
 * این سرویس بازنویسی تمیز `ClusterService` فعلی (`modules/cluster/`) است و از
 * `DomainException` (`NotFoundException`/`ConflictException`) به‌جای
 * `HttpException` خام استفاده می‌کند تا با AllExceptionsFilter سراسری و
 * Response Envelope یکدست سازگار باشد (Requirement 12.4).
 */
@Injectable()
export class ClustersService {
  constructor(
    @InjectRepository(Cluster)
    private readonly clusterRepository: Repository<Cluster>,
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  /** فهرست همهٔ خوشه‌ها به‌همراه آمار سریع (تعداد منابع و نمایندگان). */
  async findAll(): Promise<ClusterWithStats[]> {
    const clusters = await this.clusterRepository.find({
      order: { created_at: 'ASC' },
    });

    return Promise.all(
      clusters.map(async (cluster) => {
        const [pagesCount, representativesCount] = await Promise.all([
          this.pageRepository.count({ where: { cluster_id: cluster.id } }),
          this.pageRepository.count({
            where: { cluster_id: cluster.id, is_representative: true },
          }),
        ]);
        return {
          ...cluster,
          pages_count: pagesCount,
          representatives_count: representativesCount,
        };
      }),
    );
  }

  /** جزئیات یک خوشه به‌همراه منابع عضو و آمار. NotFound در صورت نبود. */
  async findById(id: number): Promise<ClusterDetail> {
    const cluster = await this.requireCluster(id);

    const pages = await this.pageRepository.find({
      where: { cluster_id: id },
      order: { is_representative: 'DESC', influence_score: 'DESC' },
    });

    return {
      ...cluster,
      pages,
      pages_count: pages.length,
      representatives_count: pages.filter((p) => p.is_representative).length,
    };
  }

  /** ساخت یک خوشهٔ جدید؛ نام خوشه باید یکتا باشد (Conflict در صورت تکرار). */
  async create(dto: CreateClusterDto): Promise<Cluster> {
    const existing = await this.clusterRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `خوشه‌ای با نام «${dto.name}» قبلاً ساخته شده است`,
      );
    }
    const cluster = this.clusterRepository.create(dto);
    return this.clusterRepository.save(cluster);
  }

  /** به‌روزرسانی فیلدهای یک خوشهٔ موجود. NotFound در صورت نبود. */
  async update(id: number, dto: UpdateClusterDto): Promise<Cluster> {
    const cluster = await this.requireCluster(id);
    Object.assign(cluster, dto);
    return this.clusterRepository.save(cluster);
  }

  /**
   * حذف یک خوشه. پیش از حذف، همهٔ منابع عضو از خوشه جدا و پرچم نمایندگی‌شان پاک
   * می‌شود (`cluster_id = null`, `is_representative = false`).
   */
  async remove(id: number): Promise<void> {
    const cluster = await this.requireCluster(id);
    await this.pageRepository.update(
      { cluster_id: id },
      { cluster_id: null, is_representative: false },
    );
    await this.clusterRepository.remove(cluster);
  }

  /** فهرست منابع عضو یک خوشه (نمایندگان ابتدا، سپس بر اساس influence). */
  async getSources(id: number): Promise<Page[]> {
    await this.requireCluster(id);
    return this.pageRepository.find({
      where: { cluster_id: id },
      order: { is_representative: 'DESC', influence_score: 'DESC' },
    });
  }

  /** افزودن منابع به یک خوشه (منابع موجود حذف نمی‌شوند). */
  async assignSources(
    id: number,
    dto: AssignSourcesDto,
  ): Promise<ClusterBulkResult> {
    await this.requireCluster(id);
    if (!dto.source_ids?.length) return { updated: 0 };
    const result = await this.pageRepository.update(
      { id: In(dto.source_ids) },
      { cluster_id: id },
    );
    return { updated: result.affected ?? 0 };
  }

  /** حذف منابع از یک خوشه (و پاک‌کردن پرچم نمایندگی آن‌ها). */
  async removeSources(
    id: number,
    dto: AssignSourcesDto,
  ): Promise<ClusterBulkResult> {
    await this.requireCluster(id);
    if (!dto.source_ids?.length) return { updated: 0 };
    const result = await this.pageRepository.update(
      { id: In(dto.source_ids), cluster_id: id },
      { cluster_id: null, is_representative: false },
    );
    return { updated: result.affected ?? 0 };
  }

  /**
   * تعیین مجموعهٔ کامل نمایندگان یک خوشه: ابتدا همهٔ نمایندگان فعلی پاک و سپس
   * منابعِ انتخاب‌شده (تنها اگر عضو همین خوشه باشند) به‌عنوان نماینده تنظیم
   * می‌شوند.
   */
  async setRepresentatives(
    id: number,
    dto: SetRepresentativesDto,
  ): Promise<Page[]> {
    await this.requireCluster(id);

    await this.pageRepository.update(
      { cluster_id: id },
      { is_representative: false },
    );

    if (dto.source_ids?.length) {
      await this.pageRepository.update(
        { id: In(dto.source_ids), cluster_id: id },
        { is_representative: true },
      );
    }

    return this.getSources(id);
  }

  /**
   * تغییر پرچم نماینده برای یک منبع مشخص درون یک خوشه. منبع باید عضو همان خوشه
   * باشد، در غیر این صورت Conflict.
   */
  async toggleRepresentative(
    clusterId: number,
    sourceId: number,
    dto: ToggleRepresentativeDto,
  ): Promise<Page> {
    await this.requireCluster(clusterId);
    const page = await this.pageRepository.findOne({ where: { id: sourceId } });
    if (!page) {
      throw new NotFoundException(`منبعی با شناسهٔ ${sourceId} یافت نشد`);
    }
    if (page.cluster_id !== Number(clusterId)) {
      throw new ConflictException('این منبع عضو این خوشه نیست');
    }
    page.is_representative = !!dto.is_representative;
    return this.pageRepository.save(page);
  }

  /* ------------------------------------------------------------------ */
  /* کمکی‌های داخلی                                                      */
  /* ------------------------------------------------------------------ */

  /** یافتن یک خوشه یا پرتاب NotFoundException در صورت نبود. */
  private async requireCluster(id: number): Promise<Cluster> {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) {
      throw new NotFoundException(`خوشه‌ای با شناسهٔ ${id} یافت نشد`);
    }
    return cluster;
  }
}
