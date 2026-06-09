import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MicroMediaEntity } from './micro-media.entity';
import { MicroMediaTagEntity } from './micro-media-tag.entity';
import { MediaPerformanceSnapshotEntity } from './media-performance-snapshot.entity';
import { Page } from '../modules/page/page.entity';
import { Post } from '../modules/post/post.entity';
import {
  AssignAccountDto,
  CreateMicroMediaDto,
  CreateInlineAccountDto,
  CreatePerformanceSnapshotDto,
  MicroMediaListQueryDto,
  UpdateMicroMediaDto,
} from './micro-media.dto';
import { InteractionsV2Service } from './interactions-v2.service';
import { MediaScoreService } from '../media-score/media-score.service';
import { normalizePagination, paginate, Paginated } from '../common/pagination';
import { DomainException, ERROR_CODES } from '../common/exceptions';

/** بازهٔ پیش‌فرض «تعامل اخیر»: ۶ ماه (PRD §8). */
const RECENT_INTERACTION_MONTHS = 6;

/** آیتم لیست میکرورسانه به‌همراه آمار تجمیعی نمایش‌داده‌شده در جدول. */
export type MicroMediaListItem = MicroMediaEntity & {
  tags: string[];
  accountsCount: number;
  lastInteractionAt: Date | null;
  interactionsCount: number;
  scoredIndicators: number;
  scoreAvg: number | null;
};

@Injectable()
export class MicroMediaService {
  constructor(
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(MicroMediaTagEntity)
    private readonly tagRepo: Repository<MicroMediaTagEntity>,
    @InjectRepository(MediaPerformanceSnapshotEntity)
    private readonly snapshotRepo: Repository<MediaPerformanceSnapshotEntity>,
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly interactions: InteractionsV2Service,
    private readonly scores: MediaScoreService,
  ) {}

  // --- CRUD ---

  async findById(id: number): Promise<MicroMediaEntity> {
    const media = await this.mediaRepo.findOne({ where: { id } });
    if (!media) {
      throw new DomainException(
        ERROR_CODES.MICRO_MEDIA_NOT_FOUND,
        `میکرورسانه‌ای با شناسهٔ ${id} یافت نشد`,
      );
    }
    return media;
  }

  async create(dto: CreateMicroMediaDto): Promise<MicroMediaEntity> {
    const { tags, accounts, ...fields } = dto;
    const media = this.mediaRepo.create(fields);
    const saved = await this.mediaRepo.save(media);
    if (tags?.length) {
      await this.setTags(saved.id, tags);
    }
    if (accounts?.length) {
      await this.createInlineAccounts(saved.id, accounts);
    }
    return saved;
  }

  /**
   * ساخت گروهی میکرورسانه (ایمپورت اکسل/CSV). ردیف‌های بدون نام یا با نام تکراری
   * رد می‌شوند (idempotent نسبت به نام). هر ردیف می‌تواند سکوهای خود را داشته باشد.
   */
  async createBulk(dtos: CreateMicroMediaDto[]): Promise<{
    created: MicroMediaEntity[];
    skipped: Array<{ name: string; reason: string }>;
  }> {
    const created: MicroMediaEntity[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    for (const dto of dtos ?? []) {
      const name = (dto.name ?? '').trim();
      if (!name) {
        skipped.push({ name: dto.name ?? '', reason: 'بدون نام' });
        continue;
      }
      const existing = await this.mediaRepo.findOne({ where: { name } });
      if (existing) {
        skipped.push({ name, reason: 'تکراری' });
        continue;
      }
      const media = await this.create({ ...dto, name });
      created.push(media);
    }
    return { created, skipped };
  }

  /** ساخت سکوها (pages) همزمان با ساخت میکرورسانه. */
  private async createInlineAccounts(
    microMediaId: number,
    accounts: CreateInlineAccountDto[],
  ): Promise<void> {
    let index = 0;
    for (const a of accounts) {
      const username = (a.username ?? '').trim();
      const name = (a.name ?? '').trim() || username;
      if (!username && !name) {
        index += 1;
        continue;
      }
      const page = this.pageRepo.create({
        name,
        username: username || undefined,
        platform: a.platform || undefined,
        profile_url: a.profile_url || undefined,
        followers_count: a.followers_count ?? 0,
        micro_media_id: microMediaId,
        is_primary: a.is_primary ?? index === 0,
      });
      await this.pageRepo.save(page);
      index += 1;
    }
  }

  async update(
    id: number,
    dto: UpdateMicroMediaDto,
  ): Promise<MicroMediaEntity> {
    const media = await this.findById(id);
    Object.assign(media, dto);
    return this.mediaRepo.save(media);
  }

  /** حذف نرم: status را به archived تغییر می‌دهد (داده حفظ می‌شود). */
  async deactivate(id: number): Promise<MicroMediaEntity> {
    const media = await this.findById(id);
    media.status = 'archived';
    return this.mediaRepo.save(media);
  }

  // --- list فیلترپذیر ---

  async list(
    query: MicroMediaListQueryDto,
    scope?: { privileged: boolean; hubIds: number[] },
  ): Promise<Paginated<MicroMediaListItem>> {
    const pagination = normalizePagination(query);
    const qb = this.mediaRepo.createQueryBuilder('m');

    // فیلتر scope هاب (Correctness Property 5): نقش‌های غیرفراگیر تنها رسانه‌های
    // هاب‌های مجاز خود را می‌بینند. با AUTH_ENFORCE خاموش، scope.privileged=true
    // است و این فیلتر اعمال نمی‌شود.
    if (scope && !scope.privileged) {
      if (scope.hubIds.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('m.hub_id IN (:...scopeHubIds)', {
          scopeHubIds: scope.hubIds,
        });
      }
    }

    if (query.hubId) qb.andWhere('m.hub_id = :hubId', { hubId: query.hubId });
    if (query.clusterId)
      qb.andWhere('m.topic_cluster_id = :clusterId', {
        clusterId: query.clusterId,
      });
    if (query.activityDomain)
      qb.andWhere('m.activity_domain = :ad', { ad: query.activityDomain });
    if (query.country) qb.andWhere('m.country = :country', { country: query.country });
    if (query.language)
      qb.andWhere('m.language = :language', { language: query.language });
    if (query.status) qb.andWhere('m.status = :status', { status: query.status });
    if (query.search)
      qb.andWhere(
        '(m.name ILIKE :s OR m.contact_name ILIKE :s OR m.contact_phone ILIKE :s)',
        { s: `%${query.search}%` },
      );

    if (query.tag) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM micro_media_tags t WHERE t.micro_media_id = m.id AND t.tag = :tag)',
        { tag: query.tag },
      );
    }

    if (query.platform) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM pages p WHERE p.micro_media_id = m.id AND p.platform = :platform)',
        { platform: query.platform },
      );
    }

    // فیلتر تعامل اخیر / بدون تعامل
    if (query.hasRecentInteraction === 'true' || query.noInteractionSince) {
      const since = query.noInteractionSince
        ? new Date(query.noInteractionSince)
        : this.monthsAgo(RECENT_INTERACTION_MONTHS);
      const activeIds = await this.interactions.mediaIdsActiveSince(since);
      if (query.hasRecentInteraction === 'true') {
        if (activeIds.length === 0) {
          qb.andWhere('1 = 0');
        } else {
          qb.andWhere('m.id IN (:...activeIds)', { activeIds });
        }
      } else {
        // noInteractionSince → رسانه‌هایی که در active نیستند
        if (activeIds.length > 0) {
          qb.andWhere('m.id NOT IN (:...activeIds)', { activeIds });
        }
      }
    }

    qb.orderBy('m.created_at', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take);

    const [items, total] = await qb.getManyAndCount();
    const withTags = await this.attachTags(items);
    const enriched = await this.attachStats(withTags);
    return paginate(enriched, total, pagination);
  }

  // --- tags ---

  async getTags(microMediaId: number): Promise<string[]> {
    const rows = await this.tagRepo.find({
      where: { micro_media_id: microMediaId },
    });
    return rows.map((r) => r.tag);
  }

  async setTags(microMediaId: number, tags: string[]): Promise<string[]> {
    await this.findById(microMediaId);
    await this.tagRepo.delete({ micro_media_id: microMediaId });
    const unique = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
    if (unique.length) {
      await this.tagRepo.save(
        unique.map((tag) =>
          this.tagRepo.create({ micro_media_id: microMediaId, tag }),
        ),
      );
    }
    return unique;
  }

  // --- accounts (pages) ---

  async listAccounts(microMediaId: number): Promise<Page[]> {
    await this.findById(microMediaId);
    return this.pageRepo.find({ where: { micro_media_id: microMediaId } });
  }

  /**
   * ساخت یک سکوی (page) جدید برای میکرورسانهٔ موجود و اتصال آن.
   * بر خلاف attachAccount (که page موجود را وصل می‌کند)، این متد یک حساب پلتفرمی
   * تازه می‌سازد.
   */
  async createAccount(
    microMediaId: number,
    dto: CreateInlineAccountDto,
  ): Promise<Page> {
    await this.findById(microMediaId);
    const username = (dto.username ?? '').trim();
    const name = (dto.name ?? '').trim() || username;
    if (!username && !name) {
      throw new DomainException(
        ERROR_CODES.VALIDATION_ERROR,
        'نام یا نام کاربری سکو الزامی است',
      );
    }
    const existingCount = await this.pageRepo.count({
      where: { micro_media_id: microMediaId },
    });
    const page = this.pageRepo.create({
      name,
      username: username || undefined,
      platform: dto.platform || undefined,
      profile_url: dto.profile_url || undefined,
      followers_count: dto.followers_count ?? 0,
      micro_media_id: microMediaId,
      is_primary: dto.is_primary ?? existingCount === 0,
    });
    return this.pageRepo.save(page);
  }

  /** اتصال یک page موجود به این میکرورسانه (یا انتقال از میکرورسانهٔ دیگر). */
  async attachAccount(
    microMediaId: number,
    dto: AssignAccountDto,
  ): Promise<Page> {
    await this.findById(microMediaId);
    const page = await this.pageRepo.findOne({ where: { id: dto.page_id } });
    if (!page) {
      throw new DomainException(
        ERROR_CODES.NOT_FOUND,
        `حساب (page) با شناسهٔ ${dto.page_id} یافت نشد`,
      );
    }
    page.micro_media_id = microMediaId;
    if (dto.is_primary !== undefined) page.is_primary = !!dto.is_primary;
    return this.pageRepo.save(page);
  }

  async detachAccount(pageId: number): Promise<Page> {
    const page = await this.pageRepo.findOne({ where: { id: pageId } });
    if (!page) {
      throw new DomainException(
        ERROR_CODES.NOT_FOUND,
        `حساب (page) با شناسهٔ ${pageId} یافت نشد`,
      );
    }
    page.micro_media_id = null;
    page.is_primary = false;
    return this.pageRepo.save(page);
  }

  // --- performance snapshots ---

  async listPerformance(
    microMediaId: number,
  ): Promise<MediaPerformanceSnapshotEntity[]> {
    await this.findById(microMediaId);
    return this.snapshotRepo.find({
      where: { micro_media_id: microMediaId },
      order: { captured_at: 'ASC' },
    });
  }

  async createPerformanceSnapshot(
    microMediaId: number,
    dto: CreatePerformanceSnapshotDto,
    source = 'manual',
  ): Promise<MediaPerformanceSnapshotEntity> {
    await this.findById(microMediaId);
    const snapshot = this.snapshotRepo.create({
      micro_media_id: microMediaId,
      page_id: dto.page_id ?? null,
      platform: dto.platform ?? null,
      followers: dto.followers ?? null,
      views: dto.views ?? null,
      likes: dto.likes ?? null,
      comments: dto.comments ?? null,
      shares: dto.shares ?? null,
      posts_count: dto.posts_count ?? null,
      content_count: dto.content_count ?? null,
      engagement_rate: dto.engagement_rate ?? null,
      growth_rate: dto.growth_rate ?? null,
      captured_at: new Date(),
      source,
    });
    return this.snapshotRepo.save(snapshot);
  }

  /**
   * ساخت snapshot از روی دادهٔ فعلی pageهای متصل (فاز ۴ — refresh-performance).
   * مقادیر followers/posts/engagement را از pages جمع می‌کند.
   */
  async refreshPerformanceFromPages(
    microMediaId: number,
  ): Promise<MediaPerformanceSnapshotEntity[]> {
    const pages = await this.listAccounts(microMediaId);
    const snapshots: MediaPerformanceSnapshotEntity[] = [];
    for (const p of pages) {
      const snap = await this.snapshotRepo.save(
        this.snapshotRepo.create({
          micro_media_id: microMediaId,
          page_id: p.id,
          platform: p.platform ?? null,
          followers: p.followers_count ?? null,
          posts_count: p.posts_count ?? null,
          engagement_rate: p.engagement_rate ?? null,
          captured_at: new Date(),
          source: 'system',
        }),
      );
      p.last_synced_at = new Date();
      await this.pageRepo.save(p);
      snapshots.push(snap);
    }
    return snapshots;
  }

  // --- content (پست‌ها) و پیشنهاد پروفایل (فاز ۴) ---

  /** پست‌های اخیرِ همهٔ حساب‌های متصل به این میکرورسانه. */
  async getRecentPosts(microMediaId: number, limit = 20): Promise<Post[]> {
    const pages = await this.listAccounts(microMediaId);
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length === 0) return [];
    return this.postRepo.find({
      where: { page_id: In(pageIds) },
      order: { published_at: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  /**
   * پیشنهاد تکمیل پروفایل از تحلیل موجودِ حساب‌های متصل (design §7؛ AI کمکی).
   *
   * این نسخه از تحلیل قبلیِ pageها (category/keywords/narrative/country/language)
   * و پست‌های اخیر استفاده می‌کند و **هیچ مقداری را خودکار اعمال نمی‌کند** —
   * خروجی صرفاً پیشنهاد است و کارشناس آن را تأیید/ویرایش می‌کند (Human-Driven).
   */
  async suggestProfileFromPosts(
    microMediaId: number,
  ): Promise<Record<string, unknown>> {
    const media = await this.findById(microMediaId);
    const pages = await this.listAccounts(microMediaId);
    const posts = await this.getRecentPosts(microMediaId, 20);

    // حوزهٔ فعالیت پیشنهادی: پرتکرارترین category میان حساب‌ها.
    const categoryCount = new Map<string, number>();
    for (const p of pages) {
      if (p.category) categoryCount.set(p.category, (categoryCount.get(p.category) ?? 0) + 1);
    }
    const suggestedDomain =
      [...categoryCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // برچسب‌های پیشنهادی: اجتماع keywords حساب‌ها (حداکثر ۱۰).
    const tagSet = new Set<string>();
    for (const p of pages) {
      for (const k of (p.keywords as string[] | null) ?? []) {
        if (k) tagSet.add(k);
      }
    }
    const suggestedTags = [...tagSet].slice(0, 10);

    // توضیح هویت پیشنهادی: narrative حساب اصلی یا اولین حساب دارای narrative.
    const primary = pages.find((p) => p.is_primary) ?? pages[0];
    const suggestedIdentity =
      primary?.narrative_description ??
      pages.find((p) => p.narrative_description)?.narrative_description ??
      null;

    const suggestedCountry = pages.find((p) => p.country)?.country ?? null;
    const suggestedLanguage = pages.find((p) => p.language)?.language ?? null;

    return {
      source: 'derived_from_connected_accounts',
      basedOnAccounts: pages.length,
      basedOnPosts: posts.length,
      current: {
        activity_domain: media.activity_domain,
        identity_description: media.identity_description,
        country: media.country,
        language: media.language,
      },
      suggestions: {
        activity_domain: suggestedDomain,
        identity_description: suggestedIdentity,
        country: suggestedCountry,
        language: suggestedLanguage,
        tags: suggestedTags,
      },
    };
  }

  // --- helpers ---

  private monthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }

  private async attachTags(
    items: MicroMediaEntity[],
  ): Promise<Array<MicroMediaEntity & { tags: string[] }>> {
    if (items.length === 0) return [];
    const ids = items.map((m) => m.id);
    const tagRows = await this.tagRepo.find({
      where: { micro_media_id: In(ids) },
    });
    const byMedia = new Map<number, string[]>();
    for (const t of tagRows) {
      const arr = byMedia.get(t.micro_media_id) ?? [];
      arr.push(t.tag);
      byMedia.set(t.micro_media_id, arr);
    }
    return items.map((m) => ({ ...m, tags: byMedia.get(m.id) ?? [] }));
  }

  /**
   * افزودن آمار تجمیعی به آیتم‌های لیست: تعداد سکوها، آخرین تعامل و تعداد تعاملات،
   * و خلاصهٔ امتیاز (تعداد شاخص امتیازدهی‌شده و میانگین).
   */
  private async attachStats(
    items: Array<MicroMediaEntity & { tags: string[] }>,
  ): Promise<MicroMediaListItem[]> {
    if (items.length === 0) return [];
    const ids = items.map((m) => m.id);

    const accRows = await this.pageRepo
      .createQueryBuilder('p')
      .select('p.micro_media_id', 'mid')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.micro_media_id IN (:...ids)', { ids })
      .groupBy('p.micro_media_id')
      .getRawMany<{ mid: number; cnt: string }>();
    const accMap = new Map(accRows.map((r) => [Number(r.mid), Number(r.cnt)]));

    const interMap = await this.interactions.statsForMediaIds(ids);
    const scoreMap = await this.scores.summaryForMediaIds(ids);

    return items.map((m) => ({
      ...m,
      accountsCount: accMap.get(m.id) ?? 0,
      lastInteractionAt: interMap.get(m.id)?.last ?? null,
      interactionsCount: interMap.get(m.id)?.count ?? 0,
      scoredIndicators: scoreMap.get(m.id)?.scoredIndicators ?? 0,
      scoreAvg: scoreMap.get(m.id)?.avg ?? null,
    }));
  }
}
