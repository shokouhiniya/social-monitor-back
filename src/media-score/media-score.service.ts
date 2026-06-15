import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MediaScoreIndicatorEntity } from './media-score-indicator.entity';
import { MediaScoreRecordEntity } from './media-score-record.entity';
import { MicroMediaEntity } from '../micro-media/micro-media.entity';
import { User } from '../modules/user/user.entity';
import {
  BatchScoreDto,
  CreateIndicatorDto,
  CreateScoreRecordDto,
  UpdateIndicatorDto,
} from './media-score.dto';
import { DomainException, ERROR_CODES } from '../common/exceptions';

/**
 * سرویس Media Score (design §3.5).
 *
 *  - مدیریت شاخص‌ها (indicators) — فعال/غیرفعال، وزن، ترتیب.
 *  - ثبت رکورد امتیاز با اعتبارسنجی بازهٔ `[min_value, max_value]`
 *    (Correctness Property 3) و upsert بر اساس (media, indicator, period_start)
 *    (Correctness Property 6).
 *  - آخرین مقدار هر شاخص و روند (trend) در طول زمان.
 *  - لیدربرد: رتبه‌بندی میکرورسانه‌ها بر اساس هر شاخص یا امتیاز کلیِ وزنی.
 */
@Injectable()
export class MediaScoreService {
  constructor(
    @InjectRepository(MediaScoreIndicatorEntity)
    private readonly indicatorRepo: Repository<MediaScoreIndicatorEntity>,
    @InjectRepository(MediaScoreRecordEntity)
    private readonly recordRepo: Repository<MediaScoreRecordEntity>,
    @InjectRepository(MicroMediaEntity)
    private readonly mediaRepo: Repository<MicroMediaEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // --- indicators ---

  async listIndicators(
    includeInactive = false,
  ): Promise<MediaScoreIndicatorEntity[]> {
    const where = includeInactive ? {} : { is_active: true };
    return this.indicatorRepo.find({
      where,
      order: { sort_order: 'ASC', id: 'ASC' },
    });
  }

  async createIndicator(
    dto: CreateIndicatorDto,
  ): Promise<MediaScoreIndicatorEntity> {
    const indicator = this.indicatorRepo.create(dto);
    return this.indicatorRepo.save(indicator);
  }

  async updateIndicator(
    id: number,
    dto: UpdateIndicatorDto,
  ): Promise<MediaScoreIndicatorEntity> {
    const indicator = await this.indicatorRepo.findOne({ where: { id } });
    if (!indicator) {
      throw new DomainException(
        ERROR_CODES.MEDIA_SCORE_INDICATOR_NOT_FOUND,
        `شاخصی با شناسهٔ ${id} یافت نشد`,
      );
    }
    Object.assign(indicator, dto);
    return this.indicatorRepo.save(indicator);
  }

  async deleteIndicator(id: number): Promise<{ deleted: true }> {
    const indicator = await this.indicatorRepo.findOne({ where: { id } });
    if (!indicator) {
      throw new DomainException(
        ERROR_CODES.MEDIA_SCORE_INDICATOR_NOT_FOUND,
        `شاخصی با شناسهٔ ${id} یافت نشد`,
      );
    }
    await this.indicatorRepo.delete({ id });
    return { deleted: true };
  }

  // --- records ---

  /** ثبت یا به‌روزرسانی (upsert) یک رکورد امتیاز برای یک دوره. */
  async upsertRecord(
    dto: CreateScoreRecordDto,
  ): Promise<MediaScoreRecordEntity> {
    const indicator = await this.indicatorRepo.findOne({
      where: { id: dto.indicator_id },
    });
    if (!indicator) {
      throw new DomainException(
        ERROR_CODES.MEDIA_SCORE_INDICATOR_NOT_FOUND,
        `شاخصی با شناسهٔ ${dto.indicator_id} یافت نشد`,
      );
    }

    if (dto.value < indicator.min_value || dto.value > indicator.max_value) {
      throw new DomainException(
        ERROR_CODES.INVALID_SCORE_VALUE,
        `مقدار ${dto.value} خارج از بازهٔ مجاز [${indicator.min_value}, ${indicator.max_value}] برای شاخص «${indicator.title}» است`,
      );
    }

    const existing = await this.recordRepo.findOne({
      where: {
        micro_media_id: dto.micro_media_id,
        indicator_id: dto.indicator_id,
        period_start: dto.period_start,
      },
    });

    if (existing) {
      existing.value = dto.value;
      existing.period_end = dto.period_end ?? existing.period_end;
      existing.scored_by_user_id =
        dto.scored_by_user_id ?? existing.scored_by_user_id;
      existing.note = dto.note ?? existing.note;
      return this.recordRepo.save(existing);
    }

    const record = this.recordRepo.create({
      micro_media_id: dto.micro_media_id,
      indicator_id: dto.indicator_id,
      value: dto.value,
      period_start: dto.period_start,
      period_end: dto.period_end ?? null,
      scored_by_user_id: dto.scored_by_user_id ?? null,
      note: dto.note ?? null,
    });
    return this.recordRepo.save(record);
  }

  /**
   * ثبت گروهیِ امتیازِ چند شاخص برای یک میکرورسانه در یک دوره (یک‌بار ذخیره).
   * هر شاخص با همان منطق upsert/اعتبارسنجی ثبت می‌شود.
   */
  async batchUpsert(dto: BatchScoreDto): Promise<{ saved: number }> {
    let saved = 0;
    for (const s of dto.scores ?? []) {
      await this.upsertRecord({
        micro_media_id: dto.micro_media_id,
        indicator_id: s.indicator_id,
        value: s.value,
        period_start: dto.period_start,
        scored_by_user_id: dto.scored_by_user_id,
      });
      saved += 1;
    }
    return { saved };
  }

  /**
   * لیدربرد رتبه‌بندی میکرورسانه‌ها (design §8).
   *
   *  - اگر `indicatorId` داده شود: رتبه‌بندی بر اساس آخرین مقدارِ همان شاخص.
   *  - در غیر این صورت: رتبه‌بندی بر اساس «امتیاز کلیِ وزنی» = میانگین وزنیِ آخرین
   *    مقادیرِ شاخص‌های فعالِ امتیازدهی‌شده.
   *
   * «آخرین مقدار» با `DISTINCT ON (micro_media_id, indicator_id) ... ORDER BY
   * period_start DESC` محاسبه می‌شود (یک query، بدون N+1).
   */
  async leaderboard(
    indicatorId?: number,
    limit = 50,
    scope?: { privileged: boolean; hubIds: number[] },
  ): Promise<{
    indicator: MediaScoreIndicatorEntity | null;
    indicators: Array<{ id: number; key: string; title: string }>;
    rows: Array<{
      rank: number;
      micro_media_id: number;
      name: string;
      hub_id: number | null;
      value: number;
    }>;
  }> {
    const indicators = await this.indicatorRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const indicatorMap = new Map(indicators.map((i) => [i.id, i]));

    // scope هاب: مجموعهٔ میکرورسانه‌های مجاز برای کاربر غیرفراگیر.
    let allowedMediaIds: Set<number> | null = null;
    if (scope && !scope.privileged) {
      if (scope.hubIds.length === 0) {
        allowedMediaIds = new Set();
      } else {
        const allowed = await this.mediaRepo.find({
          where: { hub_id: In(scope.hubIds) },
          select: ['id'],
        });
        allowedMediaIds = new Set(allowed.map((m) => m.id));
      }
    }

    const latest: Array<{
      micro_media_id: number;
      indicator_id: number;
      value: string;
    }> = await this.recordRepo.query(
      `SELECT DISTINCT ON (micro_media_id, indicator_id)
         micro_media_id, indicator_id, value
       FROM media_score_records
       ORDER BY micro_media_id, indicator_id, period_start DESC`,
    );

    const byMedia = new Map<number, Map<number, number>>();
    for (const r of latest) {
      const mid = Number(r.micro_media_id);
      if (allowedMediaIds && !allowedMediaIds.has(mid)) continue;
      const iid = Number(r.indicator_id);
      if (!byMedia.has(mid)) byMedia.set(mid, new Map());
      byMedia.get(mid)!.set(iid, Number(r.value));
    }

    let rows: Array<{ micro_media_id: number; value: number }>;
    if (indicatorId) {
      rows = [...byMedia.entries()]
        .filter(([, m]) => m.has(indicatorId))
        .map(([mid, m]) => ({ micro_media_id: mid, value: m.get(indicatorId)! }));
    } else {
      rows = [...byMedia.entries()].map(([mid, m]) => {
        let weighted = 0;
        let weightSum = 0;
        for (const [iid, val] of m) {
          const ind = indicatorMap.get(iid);
          if (ind) {
            weighted += val * ind.weight;
            weightSum += ind.weight;
          }
        }
        const value = weightSum > 0 ? Math.round((weighted / weightSum) * 10) / 10 : 0;
        return { micro_media_id: mid, value };
      });
    }
    rows.sort((a, b) => b.value - a.value);
    rows = rows.slice(0, limit);

    const ids = rows.map((r) => r.micro_media_id);
    const medias = ids.length
      ? await this.mediaRepo.find({ where: { id: In(ids) } })
      : [];
    const mediaMap = new Map(medias.map((m) => [m.id, m]));

    return {
      indicator: indicatorId ? indicatorMap.get(indicatorId) ?? null : null,
      indicators: indicators.map((i) => ({ id: i.id, key: i.key, title: i.title })),
      rows: rows.map((r, idx) => ({
        rank: idx + 1,
        micro_media_id: r.micro_media_id,
        name: mediaMap.get(r.micro_media_id)?.name ?? `#${r.micro_media_id}`,
        hub_id: mediaMap.get(r.micro_media_id)?.hub_id ?? null,
        value: r.value,
      })),
    };
  }

  /** همهٔ رکوردهای امتیاز یک میکرورسانه (برای تب Media Score و trend). */
  async listRecordsForMedia(
    microMediaId: number,
  ): Promise<MediaScoreRecordEntity[]> {
    return this.recordRepo.find({
      where: { micro_media_id: microMediaId },
      order: { period_start: 'DESC', indicator_id: 'ASC' },
    });
  }

  /**
   * جزئیات کامل امتیاز یک میکرورسانه (برای دیالوگ لیدربرد):
   *  - per-indicator: آخرین مقدار، میانگین همهٔ دوره‌ها، تعداد دوره‌ها
   *  - overall: میانگین وزنیِ آخرین مقادیر
   *  - history: لاگ کاملِ (دوره → امتیاز) با نام شاخص و نام امتیازدهنده
   */
  async mediaScoreDetail(microMediaId: number): Promise<{
    micro_media_id: number;
    name: string;
    overall: number;
    indicators: Array<{
      indicator_id: number;
      key: string;
      title: string;
      weight: number;
      min_value: number;
      max_value: number;
      latest: number | null;
      average: number | null;
      count: number;
    }>;
    history: Array<{
      id: number;
      period_start: string;
      period_end: string | null;
      indicator_id: number;
      indicator_title: string;
      value: number;
      scored_by_name: string | null;
      created_at: Date;
    }>;
  }> {
    const media = await this.mediaRepo.findOne({ where: { id: microMediaId } });
    const indicators = await this.indicatorRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const indicatorMap = new Map(indicators.map((i) => [i.id, i]));

    const records = await this.recordRepo.find({
      where: { micro_media_id: microMediaId },
      order: { period_start: 'DESC', indicator_id: 'ASC' },
    });

    // گردآوری per-indicator (latest = اولین رکورد چون DESC، average روی همهٔ دوره‌ها).
    const perIndicator = new Map<
      number,
      { latest: number | null; sum: number; count: number }
    >();
    for (const r of records) {
      const v = Number(r.value);
      if (!perIndicator.has(r.indicator_id)) {
        perIndicator.set(r.indicator_id, { latest: v, sum: v, count: 1 });
      } else {
        const agg = perIndicator.get(r.indicator_id)!;
        agg.sum += v;
        agg.count += 1;
      }
    }

    const indicatorRows = indicators.map((ind) => {
      const agg = perIndicator.get(ind.id);
      return {
        indicator_id: ind.id,
        key: ind.key,
        title: ind.title,
        weight: ind.weight,
        min_value: ind.min_value,
        max_value: ind.max_value,
        latest: agg ? agg.latest : null,
        average: agg
          ? Math.round((agg.sum / agg.count) * 10) / 10
          : null,
        count: agg ? agg.count : 0,
      };
    });

    // overall = میانگین وزنیِ آخرین مقادیر.
    let weighted = 0;
    let weightSum = 0;
    for (const row of indicatorRows) {
      if (row.latest !== null) {
        weighted += row.latest * row.weight;
        weightSum += row.weight;
      }
    }
    const overall =
      weightSum > 0 ? Math.round((weighted / weightSum) * 10) / 10 : 0;

    // نام امتیازدهندگان.
    const userIds = [
      ...new Set(
        records
          .map((r) => r.scored_by_user_id)
          .filter((id): id is number => id != null),
      ),
    ];
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const history = records.map((r) => ({
      id: r.id,
      period_start: r.period_start,
      period_end: r.period_end,
      indicator_id: r.indicator_id,
      indicator_title: indicatorMap.get(r.indicator_id)?.title ?? `#${r.indicator_id}`,
      value: Number(r.value),
      scored_by_name: r.scored_by_user_id
        ? userMap.get(r.scored_by_user_id) ?? null
        : null,
      created_at: r.created_at,
    }));

    return {
      micro_media_id: microMediaId,
      name: media?.name ?? `#${microMediaId}`,
      overall,
      indicators: indicatorRows,
      history,
    };
  }

  /** آخرین مقدار هر شاخص برای یک میکرورسانه. */
  async latestScores(
    microMediaId: number,
  ): Promise<Array<{ indicator_id: number; value: number; period_start: string }>> {
    const records = await this.recordRepo.find({
      where: { micro_media_id: microMediaId },
      order: { period_start: 'DESC' },
    });
    const seen = new Map<number, MediaScoreRecordEntity>();
    for (const r of records) {
      if (!seen.has(r.indicator_id)) {
        seen.set(r.indicator_id, r);
      }
    }
    return Array.from(seen.values()).map((r) => ({
      indicator_id: r.indicator_id,
      value: r.value,
      period_start: r.period_start,
    }));
  }

  /**
   * خلاصهٔ امتیاز برای فهرستی از میکرورسانه‌ها (برای ستون «امتیاز» در جدول لیست).
   * برای هر شناسه: تعداد شاخص‌های امتیازدهی‌شده و میانگین آخرین مقادیر.
   */
  async summaryForMediaIds(
    ids: number[],
  ): Promise<Map<number, { scoredIndicators: number; avg: number | null }>> {
    const map = new Map<
      number,
      { scoredIndicators: number; avg: number | null }
    >();
    if (ids.length === 0) return map;

    const records = await this.recordRepo.find({
      where: { micro_media_id: In(ids) },
      order: { period_start: 'DESC' },
    });

    // برای هر میکرورسانه، آخرین مقدار هر شاخص را نگه می‌داریم.
    const perMedia = new Map<number, Map<number, number>>();
    for (const r of records) {
      if (!perMedia.has(r.micro_media_id)) {
        perMedia.set(r.micro_media_id, new Map());
      }
      const indMap = perMedia.get(r.micro_media_id)!;
      if (!indMap.has(r.indicator_id)) {
        indMap.set(r.indicator_id, Number(r.value));
      }
    }

    for (const [mid, indMap] of perMedia) {
      const vals = [...indMap.values()];
      const avg = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : null;
      map.set(mid, { scoredIndicators: vals.length, avg });
    }
    return map;
  }
}
