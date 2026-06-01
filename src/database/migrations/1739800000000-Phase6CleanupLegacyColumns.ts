import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت پاک‌سازی فاز ۶ — drop ستون‌های تحلیلی قدیمی جدول `posts`
 * (Requirement 13.7، طراحی §۸.۲/§۸.۳).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  ⚠️  هشدار بحرانی — این مهاجرت «بازگشت‌ناپذیر» (IRREVERSIBLE) است  ⚠️       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * این مهاجرت بر خلاف همهٔ مهاجرت‌های افزایشی (additive) فاز ۲–۶ **تخریبی** است:
 * ستون‌های قدیمی و دادهٔ درون آن‌ها برای همیشه drop می‌شوند. پس از اجرا، داده‌های
 * این ستون‌ها **به هیچ روشی از طریق `down()` قابل بازیابی نیستند** — تنها راه
 * بازیابی، restore از dump پشتیبانی است که پیش از اجرا گرفته‌اید.
 *
 * ── پیش‌نیاز اجباری: dump پشتیبان ──────────────────────────────────────────
 * پیش از اجرای این مهاجرت، حتماً یک dump کامل از دیتابیس بگیرید، مثلاً:
 *
 *     pg_dump --format=custom --file=backup-pre-cleanup.dump "$DATABASE_URL"
 *
 * بدون این پشتیبان، در صورت بروز خطا امکان بازگشت وجود ندارد.
 *
 * ── محافظ env (opt-in صریح) ────────────────────────────────────────────────
 * برای جلوگیری از فاجعهٔ از دست رفتن داده هنگام اجرای خودکار مهاجرت‌ها در
 * CI/staging/production، این مهاجرت به‌صورت پیش‌فرض **هیچ ستونی را drop
 * نمی‌کند**. `up()` تنها زمانی واقعاً ستون‌ها را drop می‌کند که متغیر محیطی
 * زیر صراحتاً تنظیم شده باشد:
 *
 *     ALLOW_DESTRUCTIVE_CLEANUP=true
 *
 * اگر این متغیر تنظیم نشده باشد، `up()` یک پیام واضح log می‌کند (بازگشت‌ناپذیر
 * بودن، الزام dump و skip شدن) و **بدون drop کردن چیزی** و بدون خطا بازمی‌گردد؛
 * بنابراین در خطوط لولهٔ معمولی بی‌اثر است.
 *
 * ── پیش‌شرط دامنه‌ای پیش از فعال‌سازی محافظ ─────────────────────────────────
 * این پاک‌سازی تنها زمانی مجاز است که دورهٔ گذار دوگانه‌نویسی (Dual-write، تسک
 * ۵.۹ / Requirement 13.5) **متوقف** شده و تمام مسیرهای خواندن (AnalyticsQueryService،
 * فرانت، سرویس‌های legacy مانند PageService/PostService) به‌جای ستون‌های قدیمی
 * `posts` از `content_analysis_results` بخوانند. تا وقتی دوگانه‌نویسی فعال است،
 * این متغیر را تنظیم **نکنید**.
 *
 * ── ستون‌هایی که (با فعال بودن محافظ) drop می‌شوند ─────────────────────────
 * این ستون‌ها با مهاجرت به `content_analysis_results` زائد شده‌اند (طراحی §۸.۳):
 *   - `posts.sentiment_score`     → جایگزین: `content_analysis_results.sentiment_score`
 *   - `posts.sentiment_label`     → جایگزین: `content_analysis_results.sentiment_label`
 *   - `posts.extracted_keywords`  → جایگزین: `content_analysis_results.keywords`
 *   - `posts.extracted_topics`    → جایگزین: `content_analysis_results.topics`
 *
 * رویکرد محتاطانه: تنها همین چهار ستونِ صراحتاً مستندشده هدف قرار می‌گیرند و هر
 * drop با `IF EXISTS` انجام می‌شود تا اجرای دوباره امن (idempotent) بماند.
 *
 * timestamp این مهاجرت (۱۷۳۹۸۰۰۰۰۰۰۰۰) عمداً پس از `Phase6DailyMetrics1739700000000`
 * انتخاب شده تا به‌عنوان آخرین گام فاز ۶ و پس از همهٔ مهاجرت‌های افزایشی اجرا شود.
 */

/** نام متغیر محیطیِ محافظ؛ تنها با مقدار صریح `'true'` پاک‌سازی فعال می‌شود. */
const DESTRUCTIVE_CLEANUP_ENV = 'ALLOW_DESTRUCTIVE_CLEANUP';

/**
 * ستون‌های تحلیلی قدیمی جدول `posts` که با `content_analysis_results` زائد شده‌اند.
 * هر کدام با `DROP COLUMN IF EXISTS` حذف می‌شوند.
 */
const LEGACY_POST_ANALYSIS_COLUMNS = [
  'sentiment_score',
  'sentiment_label',
  'extracted_keywords',
  'extracted_topics',
] as const;

export class Phase6CleanupLegacyColumns1739800000000
  implements MigrationInterface
{
  name = 'Phase6CleanupLegacyColumns1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // محافظ صریح: اگر opt-in تنظیم نشده باشد، هیچ چیزی drop نمی‌شود.
    if (process.env[DESTRUCTIVE_CLEANUP_ENV] !== 'true') {
      // eslint-disable-next-line no-console
      console.warn(
        [
          '[Phase6CleanupLegacyColumns] SKIPPED — این مهاجرت «بازگشت‌ناپذیر» است و',
          'به‌صورت پیش‌فرض اجرا نمی‌شود.',
          `برای اجرا باید صراحتاً ${DESTRUCTIVE_CLEANUP_ENV}=true تنظیم شود و`,
          'پیش از آن یک dump پشتیبان کامل گرفته شود',
          '(pg_dump --format=custom --file=backup-pre-cleanup.dump "$DATABASE_URL").',
          'هیچ ستونی drop نشد.',
        ].join(' '),
      );
      return;
    }

    // محافظ فعال است: ستون‌های قدیمی زائد جدول `posts` drop می‌شوند.
    // هر drop با IF EXISTS انجام می‌شود تا اجرای دوباره امن بماند.
    // eslint-disable-next-line no-console
    console.warn(
      `[Phase6CleanupLegacyColumns] ${DESTRUCTIVE_CLEANUP_ENV}=true — پاک‌سازی` +
        ' بازگشت‌ناپذیر ستون‌های تحلیلی قدیمی posts آغاز شد.',
    );

    for (const column of LEGACY_POST_ANALYSIS_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "posts" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }

  public async down(): Promise<void> {
    // این مهاجرت «بازگشت‌ناپذیر» است: ستون‌های drop‌شده و دادهٔ آن‌ها از طریق
    // schema قابل بازسازی نیستند و بازیابی تنها با restore از dump پشتیبان ممکن
    // است (Requirement 13.7، طراحی §۸.۲). بنابراین برخلاف مهاجرت‌های افزایشی،
    // down() عمداً خطا پرتاب می‌کند تا rollback تصادفی رخ ندهد.
    throw new Error(
      'مهاجرت Phase6CleanupLegacyColumns «بازگشت‌ناپذیر» (IRREVERSIBLE) است: ' +
        'ستون‌های تحلیلی قدیمی posts و دادهٔ آن‌ها با down() قابل بازیابی نیستند. ' +
        'برای بازگرداندن داده باید از dump پشتیبانِ پیش از اجرا (pg_dump) restore کنید.',
    );
  }
}
