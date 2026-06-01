import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۶ — جداول summary روزانهٔ داشبورد (Requirement 13.2 / 15.3،
 * طراحی §۶.۸).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - هیچ جدول/ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *  - چهار جدول تجمیعی روزانه افزوده می‌شوند که توسط Job دوره‌ای/پایان‌refresh پر
 *    می‌شوند تا از query خام سنگین روی ~۱۰۰۰ منبع جلوگیری شود (Requirement 15.3):
 *      `network_daily_metrics`  — متریک‌های روزانهٔ هر شبکه (تعداد منبع فعال،
 *        محتوای جدید، میانگین احساس، شمار هشدار).
 *      `source_daily_metrics`   — متریک‌های روزانهٔ هر منبع (محتوای جدید، میانگین
 *        احساس، نرخ تعامل).
 *      `keyword_daily_metrics`  — شمار/سرعت رشد هر کلیدواژه در یک روز و دامنه.
 *      `cluster_daily_metrics`  — متریک‌های روزانهٔ هر cluster (شمار محتوا،
 *        میانگین هم‌راستایی).
 *
 * مطابق رویکرد محتاطانهٔ decoupled در `Phase3AnalysisResults1739400000000`،
 * ارجاع‌های مفهومی (`network_id`, `source_id`, `cluster_id`) به‌صورت ستون
 * integer ساده و **بدون FK سخت** نگه داشته می‌شوند تا وابستگی میان جدول‌ها در
 * دورهٔ گذار شکننده نباشد. مقادیر متریک nullable (`avg_sentiment`,
 * `engagement_rate`, `velocity`, `avg_alignment`) با `double precision` و
 * شمارش‌ها با `integer DEFAULT 0` تعریف می‌شوند.
 *
 * indexها (طراحی §۱۲.۳): روی سه جدول network/source/cluster یک unique index روی
 * `(<entity>_id, date)` گذاشته می‌شود تا برای هر موجودیت در هر روز تنها یک ردیف
 * وجود داشته باشد و upsert روزانه idempotent بماند. روی keyword به‌دلیل امکان
 * چند scope برای یک کلیدواژه در یک روز، تنها یک index غیر-unique روی
 * `(keyword, date)` گذاشته می‌شود.
 *
 * `down()` تنها افزوده‌های همین مهاجرت را حذف می‌کند (Requirement 13.4)؛ به‌گونه‌ای
 * که اجرای `up()` و سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3). ترتیب حذف معکوس است: ابتدا indexها، سپس جدول‌ها (به ترتیب
 * معکوس ساخت)، همگی با `IF EXISTS`.
 *
 * timestamp این مهاجرت (۱۷۳۹۷۰۰۰۰۰۰۰۰) عمداً پس از مهاجرت index های فاز ۶
 * (`Phase6Indexes1739600000000`) انتخاب شده تا ترتیب اجرای مهاجرت‌ها قطعی بماند.
 * موجودیت‌های هم‌خوان با این جدول‌ها در task بعدی (۱۱.۳ AnalyticsModule) ساخته
 * می‌شوند؛ این task تنها migration است و entity ای اضافه نمی‌کند.
 *
 * SQL خام (queryRunner.query) برای کنترل صریح و قابلیت حمل استفاده شده و در جای
 * معقول با `IF NOT EXISTS` / `IF EXISTS` به‌صورت idempotent-safe نوشته شده است.
 */
export class Phase6DailyMetrics1739700000000 implements MigrationInterface {
  name = 'Phase6DailyMetrics1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ۱) جدول جدید network_daily_metrics — متریک‌های روزانهٔ هر شبکه.
    //    `network_id` ارجاع مفهومی به networks.id (integer ساده، بدون FK سخت).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "network_daily_metrics" (
        "id" SERIAL NOT NULL,
        "network_id" integer NOT NULL,
        "date" date NOT NULL,
        "active_sources" integer NOT NULL DEFAULT 0,
        "new_content" integer NOT NULL DEFAULT 0,
        "avg_sentiment" double precision,
        "alert_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_network_daily_metrics_id" PRIMARY KEY ("id")
      )
    `);

    // unique index روی (network_id, date) — برای هر شبکه در هر روز یک ردیف
    // (upsert روزانه idempotent؛ طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_network_daily_metrics_network_date"
        ON "network_daily_metrics" ("network_id", "date")
    `);

    // ۲) جدول جدید source_daily_metrics — متریک‌های روزانهٔ هر منبع.
    //    `source_id` ارجاع مفهومی به pages.id (integer ساده، بدون FK سخت).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "source_daily_metrics" (
        "id" SERIAL NOT NULL,
        "source_id" integer NOT NULL,
        "date" date NOT NULL,
        "new_content" integer NOT NULL DEFAULT 0,
        "avg_sentiment" double precision,
        "engagement_rate" double precision,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_source_daily_metrics_id" PRIMARY KEY ("id")
      )
    `);

    // unique index روی (source_id, date) — برای هر منبع در هر روز یک ردیف
    // (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_source_daily_metrics_source_date"
        ON "source_daily_metrics" ("source_id", "date")
    `);

    // ۳) جدول جدید keyword_daily_metrics — شمار/سرعت رشد هر کلیدواژه در یک روز.
    //    `scope` (nullable) دامنهٔ شمارش (مثلاً سراسری یا یک شبکه) را مشخص می‌کند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "keyword_daily_metrics" (
        "id" SERIAL NOT NULL,
        "keyword" character varying NOT NULL,
        "date" date NOT NULL,
        "scope" character varying,
        "count" integer NOT NULL DEFAULT 0,
        "velocity" double precision,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_keyword_daily_metrics_id" PRIMARY KEY ("id")
      )
    `);

    // index غیر-unique روی (keyword, date) — واکشی سریع روند یک کلیدواژه؛
    // unique نیست چون یک کلیدواژه می‌تواند در یک روز چند scope داشته باشد
    // (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_keyword_daily_metrics_keyword_date"
        ON "keyword_daily_metrics" ("keyword", "date")
    `);

    // ۴) جدول جدید cluster_daily_metrics — متریک‌های روزانهٔ هر cluster.
    //    `cluster_id` ارجاع مفهومی (integer ساده، بدون FK سخت).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cluster_daily_metrics" (
        "id" SERIAL NOT NULL,
        "cluster_id" integer NOT NULL,
        "date" date NOT NULL,
        "content_count" integer NOT NULL DEFAULT 0,
        "avg_alignment" double precision,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cluster_daily_metrics_id" PRIMARY KEY ("id")
      )
    `);

    // unique index روی (cluster_id, date) — برای هر cluster در هر روز یک ردیف
    // (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cluster_daily_metrics_cluster_date"
        ON "cluster_daily_metrics" ("cluster_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزوده‌های همین مهاجرت حذف می‌شوند (Requirement 13.4).
    // ترتیب معکوس up: ابتدا index، سپس جدول (به ترتیب معکوس ساخت).

    // ۴) حذف index و سپس جدول cluster_daily_metrics.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cluster_daily_metrics_cluster_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cluster_daily_metrics"`);

    // ۳) حذف index و سپس جدول keyword_daily_metrics.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_keyword_daily_metrics_keyword_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "keyword_daily_metrics"`);

    // ۲) حذف index و سپس جدول source_daily_metrics.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_source_daily_metrics_source_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "source_daily_metrics"`);

    // ۱) حذف index و سپس جدول network_daily_metrics.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_network_daily_metrics_network_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "network_daily_metrics"`);
  }
}
