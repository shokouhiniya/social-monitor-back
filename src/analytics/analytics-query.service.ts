import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ValidationException } from '../common/exceptions';
import {
  DateRange,
  KeywordVelocity,
  MacroDashboard,
  NetworkPulse,
  ScopeFilter,
  TimelinePoint,
} from './analytics.types';
import { ClusterDailyMetricEntity } from './entities/cluster-daily-metric.entity';
import { KeywordDailyMetricEntity } from './entities/keyword-daily-metric.entity';
import { NetworkDailyMetricEntity } from './entities/network-daily-metric.entity';
import { SourceDailyMetricEntity } from './entities/source-daily-metric.entity';

/** بیشینهٔ تعداد کلیدواژه‌های بازگشتی در `getKeywordVelocity`. */
const KEYWORD_VELOCITY_LIMIT = 50;
/** طول پیش‌فرض خط‌زمانی کوتاهِ `getNetworkPulse` (روز). */
const NETWORK_PULSE_TIMELINE_DAYS = 14;

/**
 * عبارت SQL میانگین وزن‌دارِ احساس بر اساس حجم محتوا.
 * وزن هر روز/ردیف `new_content` است و ردیف‌های فاقد احساس از مخرج کنار می‌روند.
 * `alias` نام مستعار جدول summary را مشخص می‌کند (مثلاً `n`).
 */
function weightedSentiment(alias: string): string {
  return (
    `SUM(${alias}.avg_sentiment * ${alias}.new_content) ` +
    `FILTER (WHERE ${alias}.avg_sentiment IS NOT NULL) ` +
    `/ NULLIF(SUM(${alias}.new_content) ` +
    `FILTER (WHERE ${alias}.avg_sentiment IS NOT NULL), 0)`
  );
}

/** تبدیل خروجی خام تاریخ (Date یا string) به رشتهٔ `YYYY-MM-DD`. */
function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** تبدیل امن خروجی عددی خام (string از pg) به `number` با مقدار پیش‌فرض. */
function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** مانند `toNum` اما در نبود مقدار `null` برمی‌گرداند (برای متریک‌های nullable). */
function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * AnalyticsQueryService — تجمیع فقط‌خواندنی داشبورد (design §5.9، Requirement 8).
 *
 * **مرز سخت معماری (Requirement 8.1 / 1.3، design §3.2):**
 *  - این سرویس هیچ fetch و هیچ فراخوانی LLM انجام نمی‌دهد.
 *  - به `SourcesService` (یا هر سرویس دامنه‌ای دیگر) وابسته نیست؛ بنابراین هیچ
 *    وابستگی circular و هیچ `forwardRef` لازم نیست.
 *  - متدهای query (`getMacroDashboard`/`getSentimentTimeline`/
 *    `getKeywordVelocity`/`getNetworkPulse`) **فقط** از جدول‌های summary روزانهٔ
 *    `*_daily_metrics` می‌خوانند، نه از query خام سنگین روی ~۱۰۰۰ منبع
 *    (Requirement 15.3).
 *  - تنها متدی که می‌نویسد `refreshSummaries` است و **تنها** در جدول‌های summary
 *    می‌نویسد؛ این متد aggregate های read-only روی `posts`/
 *    `content_analysis_results`/`pages` اجرا می‌کند و نتیجه را upsert می‌کند.
 *    هیچ واکشی پلتفرمی یا فراخوانی مدل در آن نیست.
 *
 * **دامنه (ScopeFilter):** متدهای ماکرو/خط‌زمانی، `networkId` را محترم می‌شمارند
 * (نبود آن یعنی دامنهٔ «سراسری»: تجمیع روی همهٔ شبکه‌ها). `clusterId` در
 * schema فعلی summary برای داشبورد ماکرو معادل مستقیمی ندارد و برای توسعهٔ آینده
 * در نوع نگه داشته شده است.
 */
@Injectable()
export class AnalyticsQueryService {
  constructor(
    @InjectRepository(NetworkDailyMetricEntity)
    private readonly networkMetrics: Repository<NetworkDailyMetricEntity>,
    @InjectRepository(SourceDailyMetricEntity)
    private readonly sourceMetrics: Repository<SourceDailyMetricEntity>,
    @InjectRepository(KeywordDailyMetricEntity)
    private readonly keywordMetrics: Repository<KeywordDailyMetricEntity>,
    @InjectRepository(ClusterDailyMetricEntity)
    private readonly clusterMetrics: Repository<ClusterDailyMetricEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /* ================================================================== */
  /* متدهای فقط‌خواندنی (query) — منبع: جدول‌های `*_daily_metrics`         */
  /* ================================================================== */

  /**
   * داشبورد ماکرو برای یک دامنه (Requirement 8.2). از `network_daily_metrics`
   * برای آخرین روزِ دارای داده خوانده می‌شود. اگر `scope.networkId` تعیین شود،
   * تنها همان شبکه؛ در غیر این صورت تجمیع روی همهٔ شبکه‌ها (سراسری).
   */
  async getMacroDashboard(scope: ScopeFilter): Promise<MacroDashboard> {
    const latest = await this.latestNetworkDate(scope);
    if (!latest) {
      return {
        scope,
        date: null,
        activeSources: 0,
        newContent: 0,
        avgSentiment: null,
        alertCount: 0,
      };
    }

    const qb = this.networkMetrics
      .createQueryBuilder('n')
      .select('COALESCE(SUM(n.active_sources), 0)', 'activeSources')
      .addSelect('COALESCE(SUM(n.new_content), 0)', 'newContent')
      .addSelect(weightedSentiment('n'), 'avgSentiment')
      .addSelect('COALESCE(SUM(n.alert_count), 0)', 'alertCount')
      .where('n.date = :date', { date: latest });
    this.applyNetworkScope(qb, scope);

    const row = await qb.getRawOne<{
      activeSources: string;
      newContent: string;
      avgSentiment: string | null;
      alertCount: string;
    }>();

    return {
      scope,
      date: latest,
      activeSources: toNum(row?.activeSources),
      newContent: toNum(row?.newContent),
      avgSentiment: toNumOrNull(row?.avgSentiment),
      alertCount: toNum(row?.alertCount),
    };
  }

  /**
   * خط‌زمانی احساسات برای یک دامنه و بازهٔ تاریخی (Requirement 8.3). هر نقطه
   * میانگین وزن‌دارِ احساس آن روز و تعداد محتوای جدید آن روز را دارد. مرزهای
   * بازه شامل (inclusive) هستند.
   */
  async getSentimentTimeline(
    scope: ScopeFilter,
    range: DateRange,
  ): Promise<TimelinePoint[]> {
    if (!range || !range.from || !range.to) {
      throw new ValidationException('بازهٔ زمانی (from/to) الزامی است');
    }
    if (range.from > range.to) {
      throw new ValidationException('تاریخ شروع نباید بعد از تاریخ پایان باشد');
    }

    const qb = this.networkMetrics
      .createQueryBuilder('n')
      .select('n.date', 'date')
      .addSelect('COALESCE(SUM(n.new_content), 0)', 'newContent')
      .addSelect(weightedSentiment('n'), 'avgSentiment')
      .where('n.date BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      });
    this.applyNetworkScope(qb, scope);
    qb.groupBy('n.date').orderBy('n.date', 'ASC');

    const rows = await qb.getRawMany<{
      date: unknown;
      newContent: string;
      avgSentiment: string | null;
    }>();

    return rows.map((r) => ({
      date: toIsoDate(r.date) ?? '',
      avgSentiment: toNumOrNull(r.avgSentiment),
      newContent: toNum(r.newContent),
    }));
  }

  /**
   * سرعت رشد کلیدواژه‌ها (Requirement 8.4). از `keyword_daily_metrics` برای
   * آخرین روزِ دارای داده در دامنهٔ مشخص خوانده و بر اساس `velocity` نزولی
   * (سپس `count`) مرتب می‌شود. دامنهٔ سراسری معادل `scope IS NULL` است؛ شبکهٔ
   * مشخص معادل `scope = 'network:<id>'`.
   */
  async getKeywordVelocity(scope: ScopeFilter): Promise<KeywordVelocity[]> {
    const scopeValue = this.keywordScopeValue(scope);

    const dateQb = this.keywordMetrics
      .createQueryBuilder('k')
      .select('MAX(k.date)', 'maxDate');
    this.applyKeywordScope(dateQb, scopeValue);
    const dateRow = await dateQb.getRawOne<{ maxDate: unknown }>();
    const latest = toIsoDate(dateRow?.maxDate);
    if (!latest) return [];

    const qb = this.keywordMetrics
      .createQueryBuilder('k')
      .select('k.keyword', 'keyword')
      .addSelect('k.date', 'date')
      .addSelect('k.count', 'count')
      .addSelect('k.velocity', 'velocity')
      .where('k.date = :date', { date: latest });
    this.applyKeywordScope(qb, scopeValue);
    qb.orderBy('k.velocity', 'DESC', 'NULLS LAST')
      .addOrderBy('k.count', 'DESC')
      .limit(KEYWORD_VELOCITY_LIMIT);

    const rows = await qb.getRawMany<{
      keyword: string;
      date: unknown;
      count: string;
      velocity: string | null;
    }>();

    return rows.map((r) => ({
      keyword: r.keyword,
      date: toIsoDate(r.date) ?? latest,
      count: toNum(r.count),
      velocity: toNumOrNull(r.velocity),
    }));
  }

  /**
   * نبض یک شبکه (Requirement 8.5). آخرین وضعیت تجمیعی شبکه به‌علاوهٔ یک
   * خط‌زمانی کوتاه احساس (پیش‌فرض ۱۴ روز اخیرِ دارای داده).
   */
  async getNetworkPulse(networkId: number): Promise<NetworkPulse> {
    if (networkId === undefined || networkId === null) {
      throw new ValidationException('networkId الزامی است');
    }

    const latestRow = await this.networkMetrics
      .createQueryBuilder('n')
      .where('n.network_id = :networkId', { networkId })
      .orderBy('n.date', 'DESC')
      .limit(1)
      .getOne();

    const timelineRows = await this.networkMetrics
      .createQueryBuilder('n')
      .where('n.network_id = :networkId', { networkId })
      .orderBy('n.date', 'DESC')
      .limit(NETWORK_PULSE_TIMELINE_DAYS)
      .getMany();

    // ردیف‌ها نزولی واکشی شدند؛ خط‌زمانی به ترتیب صعودی تاریخ ارائه می‌شود.
    const timeline: TimelinePoint[] = timelineRows
      .slice()
      .reverse()
      .map((r) => ({
        date: toIsoDate(r.date) ?? '',
        avgSentiment: r.avg_sentiment ?? null,
        newContent: r.new_content ?? 0,
      }));

    if (!latestRow) {
      return {
        networkId,
        date: null,
        activeSources: 0,
        newContent: 0,
        avgSentiment: null,
        alertCount: 0,
        timeline,
      };
    }

    return {
      networkId,
      date: toIsoDate(latestRow.date),
      activeSources: latestRow.active_sources ?? 0,
      newContent: latestRow.new_content ?? 0,
      avgSentiment: latestRow.avg_sentiment ?? null,
      alertCount: latestRow.alert_count ?? 0,
      timeline,
    };
  }

  /* ================================================================== */
  /* تنها متد نویسنده — پر کردن جدول‌های summary (Requirement 8.6 / 15.4)  */
  /* ================================================================== */

  /**
   * پر/به‌روزرسانی جدول‌های summary روزانه (Requirement 8.6 / 15.3 / 15.4).
   *
   * این متد aggregate های **read-only** روی دادهٔ خام (`posts`،
   * `content_analysis_results`، `pages`) اجرا و نتیجه را با upsert idempotent در
   * جدول‌های summary می‌نویسد. **هیچ** واکشی پلتفرمی یا فراخوانی LLM در آن نیست و
   * به هیچ سرویس دامنه‌ای وابسته نیست (تنها از `DataSource` با SQL پارامتری
   * استفاده می‌کند). همهٔ مراحل در یک تراکنش اجرا می‌شوند تا اتمیک بمانند.
   *
   * ترتیب: ابتدا `source_daily_metrics` (پایهٔ rollup شبکه)، سپس
   * `network_daily_metrics` (از روی source ها) و `cluster_daily_metrics`، و در
   * پایان `keyword_daily_metrics` (با محاسبهٔ velocity به‌صورت اختلاف با روز قبل).
   */
  async refreshSummaries(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // ۱) source_daily_metrics — تعداد محتوای جدید، میانگین احساس و نرخ تعامل
      //    روزانهٔ هر منبع. میانگین احساس از `content_analysis_results` (نتیجهٔ
      //    structured تحلیل) گرفته می‌شود؛ نرخ تعامل میانگین مجموع تعامل پست‌های
      //    آن روز است. upsert بر اساس unique index (source_id, date).
      await manager.query(`
        INSERT INTO source_daily_metrics
          (source_id, date, new_content, avg_sentiment, engagement_rate)
        SELECT
          post.page_id,
          post.published_at::date,
          COUNT(*)::int,
          AVG(car.sentiment_score),
          AVG(post.likes_count + post.comments_count
              + post.shares_count + post.views_count)
        FROM posts post
        LEFT JOIN content_analysis_results car ON car.content_id = post.id
        WHERE post.published_at IS NOT NULL
        GROUP BY post.page_id, post.published_at::date
        ON CONFLICT (source_id, date) DO UPDATE SET
          new_content = EXCLUDED.new_content,
          avg_sentiment = EXCLUDED.avg_sentiment,
          engagement_rate = EXCLUDED.engagement_rate
      `);

      // ۲) network_daily_metrics — rollup از source_daily_metrics روی شبکه.
      //    `active_sources` = شمار منبع دارای داده در آن روز؛ احساس وزن‌دار با
      //    حجم محتوا. ستون `alert_count` عمداً در فهرست درج نیست تا روی INSERT
      //    مقدار پیش‌فرض ۰ بگیرد و روی UPDATE مقدار موجود حفظ شود (اتصال هشدارها
      //    در لایهٔ Operations انجام می‌شود).
      await manager.query(`
        INSERT INTO network_daily_metrics
          (network_id, date, active_sources, new_content, avg_sentiment)
        SELECT
          page.network_id,
          sdm.date,
          COUNT(DISTINCT sdm.source_id)::int,
          COALESCE(SUM(sdm.new_content), 0)::int,
          SUM(sdm.avg_sentiment * sdm.new_content)
            FILTER (WHERE sdm.avg_sentiment IS NOT NULL)
            / NULLIF(SUM(sdm.new_content)
                FILTER (WHERE sdm.avg_sentiment IS NOT NULL), 0)
        FROM source_daily_metrics sdm
        JOIN pages page ON page.id = sdm.source_id
        WHERE page.network_id IS NOT NULL
        GROUP BY page.network_id, sdm.date
        ON CONFLICT (network_id, date) DO UPDATE SET
          active_sources = EXCLUDED.active_sources,
          new_content = EXCLUDED.new_content,
          avg_sentiment = EXCLUDED.avg_sentiment
      `);

      // ۳) cluster_daily_metrics — شمار محتوای روزانه و میانگین هم‌راستایی منابع
      //    هر cluster. upsert بر اساس unique index (cluster_id, date).
      await manager.query(`
        INSERT INTO cluster_daily_metrics
          (cluster_id, date, content_count, avg_alignment)
        SELECT
          page.cluster_id,
          post.published_at::date,
          COUNT(*)::int,
          AVG(page.alignment_score)
        FROM posts post
        JOIN pages page ON page.id = post.page_id
        WHERE page.cluster_id IS NOT NULL AND post.published_at IS NOT NULL
        GROUP BY page.cluster_id, post.published_at::date
        ON CONFLICT (cluster_id, date) DO UPDATE SET
          content_count = EXCLUDED.content_count,
          avg_alignment = EXCLUDED.avg_alignment
      `);

      // ۴) keyword_daily_metrics — شمار روزانهٔ هر کلیدواژه (از `extracted_keywords`)
      //    در دامنهٔ سراسری (scope IS NULL) و velocity = اختلاف با روز قبلِ همان
      //    کلیدواژه. چون جدول روی (keyword, date) unique نیست (یک کلیدواژه می‌تواند
      //    چند scope داشته باشد)، برای idempotent ماندن ابتدا ردیف‌های سراسری
      //    حذف و سپس بازتولید می‌شوند.
      await manager.query(
        `DELETE FROM keyword_daily_metrics WHERE scope IS NULL`,
      );
      await manager.query(`
        INSERT INTO keyword_daily_metrics
          (keyword, date, scope, count, velocity)
        SELECT
          daily.keyword,
          daily.date,
          NULL::varchar,
          daily.count,
          daily.count - LAG(daily.count)
            OVER (PARTITION BY daily.keyword ORDER BY daily.date)
        FROM (
          SELECT
            kw.keyword_value AS keyword,
            post.published_at::date AS date,
            COUNT(*)::int AS count
          FROM (
            SELECT id, published_at, extracted_keywords
            FROM posts
            WHERE extracted_keywords IS NOT NULL
              AND jsonb_typeof(extracted_keywords) = 'array'
              AND published_at IS NOT NULL
          ) post
          CROSS JOIN LATERAL
            jsonb_array_elements_text(post.extracted_keywords)
              AS kw(keyword_value)
          GROUP BY kw.keyword_value, post.published_at::date
        ) AS daily
      `);
    });
  }

  /* ================================================================== */
  /* کمکی‌های داخلی                                                      */
  /* ================================================================== */

  /** اعمال فیلتر `networkId` روی query جدول `network_daily_metrics`. */
  private applyNetworkScope(
    qb: SelectQueryBuilder<NetworkDailyMetricEntity>,
    scope: ScopeFilter,
  ): void {
    if (scope?.networkId !== undefined && scope.networkId !== null) {
      qb.andWhere('n.network_id = :networkId', { networkId: scope.networkId });
    }
  }

  /** آخرین تاریخِ دارای داده در `network_daily_metrics` برای دامنهٔ مشخص. */
  private async latestNetworkDate(scope: ScopeFilter): Promise<string | null> {
    const qb = this.networkMetrics
      .createQueryBuilder('n')
      .select('MAX(n.date)', 'maxDate');
    this.applyNetworkScope(qb, scope);
    const row = await qb.getRawOne<{ maxDate: unknown }>();
    return toIsoDate(row?.maxDate);
  }

  /** نگاشت دامنه به مقدار ستون `scope` در `keyword_daily_metrics`. */
  private keywordScopeValue(scope: ScopeFilter): string | null {
    if (scope?.networkId !== undefined && scope.networkId !== null) {
      return `network:${scope.networkId}`;
    }
    return null;
  }

  /** اعمال فیلتر scope (سراسری/شبکه) روی query جدول `keyword_daily_metrics`. */
  private applyKeywordScope(
    qb: SelectQueryBuilder<KeywordDailyMetricEntity>,
    scopeValue: string | null,
  ): void {
    if (scopeValue === null) {
      qb.andWhere('k.scope IS NULL');
    } else {
      qb.andWhere('k.scope = :scopeValue', { scopeValue });
    }
  }
}
