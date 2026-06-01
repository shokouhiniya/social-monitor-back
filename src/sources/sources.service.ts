import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Page } from '../modules/page/page.entity';
import {
  ConflictException,
  NotFoundException,
} from '../common/exceptions';
import {
  normalizePagination,
  paginate,
  Paginated,
  PaginationInput,
} from '../common/pagination';
import {
  AnalysisRun,
  AnalysisRunSummary,
  CollectionRunSummary,
  SourceInsightResult,
  SOURCES_ANALYSIS_DELEGATE,
  SOURCES_COLLECTION_DELEGATE,
  SourcesAnalysisDelegate,
  SourcesCollectionDelegate,
  Timeframe,
} from './sources.delegation';
import {
  BulkCreateSourceDto,
  CreateSourceDto,
  SourceListQuery,
  UpdateSourceDto,
} from './sources.dto';
import {
  isActiveToStatus,
  Source,
  SourceStatus,
  statusToIsActive,
} from './source.types';

/**
 * سرویس هستهٔ مدیریت منابع (SourcesModule — design §5.2).
 *
 * «Source» جانشین مفهومی `Page` است و روی همان جدول `pages` نگاشت می‌شود؛ از این
 * رو همان موجودیت موجود `Page` تزریق می‌شود (بدون تعریف entity دوم روی جدول
 * `pages` تا تعارض metadata رخ ندهد).
 *
 * هستهٔ CRUD + صفحه‌بندی در تسک ۳.۴ پیاده شد. عملیات سنگین (`fetch`/`analyze`/
 * `insight`) و `getAnalysisHistory` در تسک ۳.۵ افزوده شده‌اند؛ این عملیات صرفاً
 * به `CollectionService`/`AnalysisService` واگذار (delegate) می‌شوند و این
 * سرویس هرگز خودش fetch یا فراخوانی LLM انجام نمی‌دهد (design §۲ — AI لایهٔ
 * مستقل، Requirement 2.7). درز delegation از طریق توکن‌های تزریق در
 * `sources.delegation.ts` تعریف شده و wire نهایی به ماژول‌های واقعی در تسک ۵.۱۱
 * انجام می‌شود.
 */
@Injectable()
export class SourcesService {
  constructor(
    @InjectRepository(Page)
    private readonly sourceRepository: Repository<Page>,
    @Inject(SOURCES_COLLECTION_DELEGATE)
    private readonly collectionDelegate: SourcesCollectionDelegate,
    @Inject(SOURCES_ANALYSIS_DELEGATE)
    private readonly analysisDelegate: SourcesAnalysisDelegate,
  ) {}

  /**
   * فهرست صفحه‌بندی‌شدهٔ منابع مطابق قرارداد Pagination (Requirement 2.1, 12.5-12.7).
   * فیلترهای اختیاری: platform، status، networkId، clusterId و جستجوی متنی روی
   * `name`/`username`.
   */
  async findPaginated(query: SourceListQuery): Promise<Paginated<Source>> {
    const pagination = normalizePagination(query);

    const where: FindOptionsWhere<Page> = {};
    if (query.platform) {
      where.platform = query.platform;
    }
    if (query.status) {
      where.is_active = statusToIsActive(query.status as SourceStatus);
    }
    if (query.networkId !== undefined) {
      where.network_id = query.networkId;
    }
    if (query.clusterId !== undefined) {
      where.cluster_id = query.clusterId;
    }

    // جستجوی متنی روی نام یا username؛ در صورت وجود، چند شرط OR ساخته می‌شود.
    const whereClause:
      | FindOptionsWhere<Page>
      | FindOptionsWhere<Page>[] = query.search
      ? [
          { ...where, name: ILike(`%${query.search}%`) },
          { ...where, username: ILike(`%${query.search}%`) },
        ]
      : where;

    const [items, total] = await this.sourceRepository.findAndCount({
      where: whereClause,
      order: { id: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return paginate(items, total, pagination);
  }

  /** یافتن یک منبع با id؛ در صورت نبود NotFoundException (Requirement 2.2). */
  async findById(id: number): Promise<Source> {
    const source = await this.sourceRepository.findOne({ where: { id } });
    if (!source) {
      throw new NotFoundException(`منبعی با شناسهٔ ${id} یافت نشد`);
    }
    return source;
  }

  /**
   * ساخت یک منبع جدید و persist در جدول `pages` (Requirement 2.2).
   * اگر `username` + `platform` ارائه شده و از قبل موجود باشد، ConflictException.
   */
  async create(dto: CreateSourceDto): Promise<Source> {
    if (dto.username && dto.platform) {
      const existing = await this.sourceRepository.findOne({
        where: { username: dto.username, platform: dto.platform },
      });
      if (existing) {
        throw new ConflictException(
          `منبعی با username «${dto.username}» در پلتفرم «${dto.platform}» از قبل وجود دارد`,
        );
      }
    }

    const source = this.sourceRepository.create(this.toEntityFields(dto));
    return this.sourceRepository.save(source);
  }

  /**
   * واردات گروهی منابع با حذف تکراری بر اساس `username` + `platform`
   * (Requirement 2.3). منابعی که کلیدشان از قبل در دیتابیس وجود دارد یا در همین
   * batch تکراری‌اند، skip می‌شوند. تعداد `created`/`skipped` گزارش می‌شود.
   */
  async bulkCreate(
    dto: BulkCreateSourceDto,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    // کلیدهای دیده‌شده در همین batch تا تکراری درون‌دسته‌ای هم skip شود.
    const seenInBatch = new Set<string>();

    for (const item of dto.sources) {
      const key = this.dedupeKey(item.username, item.platform);

      // آیتم‌های دارای کلید معتبر را برای dedupe بررسی می‌کنیم.
      if (key) {
        if (seenInBatch.has(key)) {
          skipped += 1;
          continue;
        }
        seenInBatch.add(key);

        const existing = await this.sourceRepository.findOne({
          where: { username: item.username, platform: item.platform },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
      }

      const entity = this.sourceRepository.create(this.toEntityFields(item));
      await this.sourceRepository.save(entity);
      created += 1;
    }

    return { created, skipped };
  }

  /** به‌روزرسانی فیلدهای پروفایلی یک منبع موجود (Requirement 2.2). */
  async update(id: number, dto: UpdateSourceDto): Promise<Source> {
    const source = await this.findById(id);

    // در صورت تغییر username/platform، یکتایی کلید منطقی بررسی می‌شود.
    const nextUsername = dto.username ?? source.username;
    const nextPlatform = dto.platform ?? source.platform;
    const keyChanged =
      (dto.username !== undefined && dto.username !== source.username) ||
      (dto.platform !== undefined && dto.platform !== source.platform);

    if (keyChanged && nextUsername && nextPlatform) {
      const conflict = await this.sourceRepository.findOne({
        where: { username: nextUsername, platform: nextPlatform },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `منبعی با username «${nextUsername}» در پلتفرم «${nextPlatform}» از قبل وجود دارد`,
        );
      }
    }

    Object.assign(source, this.toEntityFields(dto));
    return this.sourceRepository.save(source);
  }

  /** حذف یک منبع موجود (Requirement 2.2). در صورت نبود NotFoundException. */
  async remove(id: number): Promise<void> {
    const source = await this.findById(id);
    await this.sourceRepository.remove(source);
  }

  /** تنظیم پرچم نماینده (representative) منبع (Requirement 2.5). */
  async setRepresentative(id: number, value: boolean): Promise<Source> {
    const source = await this.findById(id);
    source.is_representative = value;
    return this.sourceRepository.save(source);
  }

  /**
   * اختصاص یا حذف اختصاص خوشه (Requirement 2.4). مقدار `null` اختصاص را حذف
   * می‌کند (`cluster_id = null`).
   */
  async assignCluster(id: number, clusterId: number | null): Promise<Source> {
    const source = await this.findById(id);
    source.cluster_id = clusterId;
    return this.sourceRepository.save(source);
  }

  /**
   * تغییر وضعیت فعال/غیرفعال منبع (Requirement 2.6). وضعیت روی ستون `is_active`
   * مدل می‌شود؛ منابع `inactive` (`is_active = false`) از واکشی خودکار کنار
   * گذاشته می‌شوند (جریان واکشی خودکار در تسک‌های بعدی این فیلتر را اعمال می‌کند).
   */
  async setStatus(id: number, status: SourceStatus): Promise<Source> {
    const source = await this.findById(id);
    source.is_active = statusToIsActive(status);
    return this.sourceRepository.save(source);
  }

  /**
   * فهرست منابع واجد شرایط واکشی خودکار — تنها منابع فعال (`is_active = true`).
   * منابع غیرفعال طبق Requirement 2.6 کنار گذاشته می‌شوند. این متد در مسیر
   * دسته‌ای (JobsModule) استفاده خواهد شد.
   */
  async findActiveForAutoFetch(): Promise<Source[]> {
    return this.sourceRepository.find({ where: { is_active: true } });
  }

  /** نگاشت وضعیت مفهومی یک منبع از روی `is_active` (design §6.2). */
  getStatus(source: Source): SourceStatus {
    return isActiveToStatus(source.is_active);
  }

  /* ------------------------------------------------------------------ */
  /* عملیات سنگین — delegation به Collection/Analysis (Requirement 2.7) */
  /* ------------------------------------------------------------------ */

  /**
   * واکشی محتوای یک منبع (Requirement 2.7). این متد هیچ واکشی‌ای انجام نمی‌دهد؛
   * صرفاً وجود منبع را تأیید و سپس کار را به `CollectionService` واگذار می‌کند
   * (design §5.2). delegate واقعی در تسک ۵.۱۱ wire می‌شود؛ تا آن زمان placeholder
   * امن خطای صریح «هنوز wire نشده» می‌دهد.
   */
  async fetch(id: number): Promise<CollectionRunSummary> {
    const source = await this.findById(id);
    return this.collectionDelegate.collect(source);
  }

  /**
   * تحلیل محتوای یک منبع در یک بازهٔ زمانی (Requirement 2.7). هیچ فراخوانی LLM
   * در این لایه انجام نمی‌شود؛ کار به `AnalysisService.analyzeSource` واگذار
   * می‌شود (design §5.2 / §5.8). delegate واقعی در تسک ۵.۱۱ wire می‌شود.
   */
  async analyze(
    id: number,
    timeframe: Timeframe,
  ): Promise<AnalysisRunSummary> {
    // تأیید وجود منبع پیش از delegation تا خطای NOT_FOUND یکدست بماند.
    await this.findById(id);
    return this.analysisDelegate.analyzeSource(id, timeframe);
  }

  /**
   * تولید بینش (insight) یک منبع (Requirement 2.7). هیچ فراخوانی LLM در این لایه
   * انجام نمی‌شود؛ کار به `AnalysisService.generateSourceInsight` واگذار می‌شود
   * (design §5.2 / §5.8). delegate واقعی در تسک ۵.۱۱ wire می‌شود.
   */
  async insight(id: number): Promise<SourceInsightResult> {
    await this.findById(id);
    return this.analysisDelegate.generateSourceInsight(id);
  }

  /**
   * تاریخچهٔ صفحه‌بندی‌شدهٔ اجراهای تحلیل یک منبع (Requirement 2.8). مطابق
   * قرارداد Pagination (Requirement 12) خروجی `{ items, total, page, pageSize }`
   * برمی‌گرداند. وجود منبع پیش از delegation تأیید می‌شود تا رفتار NOT_FOUND
   * یکدست بماند؛ سپس query صفحه‌بندی‌شدهٔ `analysis_runs` به `AnalysisService`
   * (از طریق delegate) واگذار می‌شود — این لایه خودش هیچ query مستقیمی به
   * `analysis_runs` انجام نمی‌دهد (design §5.2).
   */
  async getAnalysisHistory(
    id: number,
    query: PaginationInput,
  ): Promise<Paginated<AnalysisRun>> {
    await this.findById(id);
    return this.analysisDelegate.getRunsForSource(id, query);
  }

  /* ------------------------------------------------------------------ */
  /* کمکی‌های داخلی                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * نگاشت فیلدهای DTO به ستون‌های موجودیت `Page`. تنها فیلدهای ارائه‌شده اعمال
   * می‌شوند تا در update، مقادیر موجود بازنویسی نشوند.
   */
  private toEntityFields(
    dto: CreateSourceDto | UpdateSourceDto,
  ): Partial<Page> {
    const fields: Partial<Page> = {};
    const assign = <K extends keyof Page>(key: K, value: Page[K] | undefined) => {
      if (value !== undefined) {
        fields[key] = value;
      }
    };

    assign('name', dto.name as Page['name']);
    assign('username', dto.username as Page['username']);
    assign('platform', dto.platform as Page['platform']);
    assign('profile_url', (dto as CreateSourceDto).profile_url as Page['profile_url']);
    assign('bio', dto.bio as Page['bio']);
    assign('profile_image_url', dto.profile_image_url as Page['profile_image_url']);
    assign('followers_count', dto.followers_count as Page['followers_count']);
    assign('following_count', dto.following_count as Page['following_count']);
    assign('network_id', dto.network_id as Page['network_id']);

    // فیلدهای مخصوص ساخت (در UpdateSourceDto وجود ندارند).
    if ('cluster_id' in dto) {
      assign('cluster_id', (dto as CreateSourceDto).cluster_id as Page['cluster_id']);
    }
    if ('is_representative' in dto) {
      assign(
        'is_representative',
        (dto as CreateSourceDto).is_representative as Page['is_representative'],
      );
    }
    if ('is_active' in dto) {
      assign('is_active', (dto as CreateSourceDto).is_active as Page['is_active']);
    }

    return fields;
  }

  /**
   * ساخت کلید dedupe از `username` + `platform`. اگر هر دو موجود نباشند `null`
   * برمی‌گرداند (آیتم بدون کلید یکتا dedupe نمی‌شود).
   */
  private dedupeKey(
    username?: string,
    platform?: string,
  ): string | null {
    if (!username || !platform) {
      return null;
    }
    return `${platform.toLowerCase()}::${username.toLowerCase()}`;
  }
}
