import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۳ — خانوادهٔ AnalysisResult (Requirement 13.2 / طراحی §۶.۳).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - هیچ جدول/ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *  - چهار جدول جدید افزوده می‌شوند:
 *      `analysis_runs` — ردیابی هر اجرای تحلیل (تک یا دسته‌ای): نوع، دامنه،
 *        وضعیت و شمارش‌های total/succeeded/failed به‌همراه زمان‌های شروع/پایان.
 *      `content_analysis_results` — خروجی structured تحلیل هر ContentItem
 *        (طراحی §۶.۵). به‌جای FK سخت، `content_id` به‌صورت ستون integer ساده نگه
 *        داشته می‌شود (ارجاع مفهومی به `posts.id`) تا مهاجرت دورهٔ گذار امن و
 *        decoupled بماند (همان رویکرد محتاطانهٔ `collection_run.source_id`).
 *      `source_insight_results` — خروجی structured insight هر Source
 *        (طراحی §۶.۶). `source_id` ارجاع مفهومی به `pages.id` (integer ساده).
 *      `network_report_results` — گزارش دورهای سطح شبکه. `network_id` ارجاع
 *        مفهومی به `networks.id` (integer ساده).
 *
 * `analysis_run_id` و `prompt_version_id` به‌صورت integer nullable نگه داشته
 * می‌شوند (بدون FK سخت) تا وابستگی میان جدول‌ها در دورهٔ گذار شکننده نباشد.
 * indexها روی `content_id` و `source_id` افزوده می‌شوند (طراحی §۱۲.۳).
 *
 * `down()` تنها افزوده‌های همین مهاجرت را حذف می‌کند (Requirement 13.4)؛ به‌گونه‌ای
 * که اجرای `up()` و سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3). ترتیب حذف معکوس است: ابتدا indexها، سپس جدول‌ها.
 *
 * timestamp این مهاجرت (۱۷۳۹۴۰۰۰۰۰۰۰۰) عمداً پس از
 * `Phase3PromptAi1739300000000` انتخاب شده تا ترتیب اجرای مهاجرت‌ها حفظ شود.
 * موجودیت‌های هم‌خوان با این جدول‌ها در task بعدی (۵.۸ AnalysisModule) ساخته
 * می‌شوند؛ این task تنها migration است و entity ای اضافه نمی‌کند.
 *
 * SQL خام (queryRunner.query) برای کنترل صریح و قابلیت حمل استفاده شده و در جای
 * معقول با `IF NOT EXISTS` / `IF EXISTS` به‌صورت idempotent-safe نوشته شده است.
 */
export class Phase3AnalysisResults1739400000000 implements MigrationInterface {
  name = 'Phase3AnalysisResults1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ۱) جدول جدید analysis_runs — ردیابی هر اجرای تحلیل.
    //    `type` نوع اجرا را مشخص می‌کند (content | source_insight | network_report).
    //    شمارش‌های total/succeeded/failed با DEFAULT 0 آغاز می‌شوند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analysis_runs" (
        "id" SERIAL NOT NULL,
        "type" character varying NOT NULL,
        "scope_ref" character varying,
        "timeframe" character varying,
        "status" character varying NOT NULL,
        "total" integer NOT NULL DEFAULT 0,
        "succeeded" integer NOT NULL DEFAULT 0,
        "failed" integer NOT NULL DEFAULT 0,
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "triggered_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analysis_runs_id" PRIMARY KEY ("id")
      )
    `);

    // ۲) جدول جدید content_analysis_results — خروجی structured تحلیل هر ContentItem.
    //    `content_id` ارجاع مفهومی به posts.id (integer ساده، بدون FK سخت).
    //    `analysis_run_id` و `prompt_version_id` nullable و بدون FK نگه داشته می‌شوند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_analysis_results" (
        "id" SERIAL NOT NULL,
        "content_id" integer NOT NULL,
        "analysis_run_id" integer,
        "prompt_version_id" integer,
        "model" character varying,
        "sentiment_score" double precision,
        "sentiment_label" character varying,
        "sentiment_reason" text,
        "keywords" jsonb,
        "topics" jsonb,
        "summary_fa" text,
        "is_relevant" boolean,
        "coverage_type" character varying,
        "narrative_position" text,
        "risk_level" character varying,
        "recommended_attention" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_analysis_results_id" PRIMARY KEY ("id")
      )
    `);

    // index روی content_id برای واکشی سریع تحلیل‌های یک محتوا (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_content_analysis_results_content_id"
        ON "content_analysis_results" ("content_id")
    `);

    // ۳) جدول جدید source_insight_results — خروجی structured insight هر Source.
    //    `source_id` ارجاع مفهومی به pages.id (integer ساده، بدون FK سخت).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "source_insight_results" (
        "id" SERIAL NOT NULL,
        "source_id" integer NOT NULL,
        "analysis_run_id" integer,
        "prompt_version_id" integer,
        "model" character varying,
        "narrative_description" text,
        "audience_description" text,
        "engagement_suggestion" text,
        "persona_radar" jsonb,
        "pain_points" jsonb,
        "topic_distribution" jsonb,
        "strategic_notes" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_source_insight_results_id" PRIMARY KEY ("id")
      )
    `);

    // index روی source_id برای واکشی سریع insightهای یک منبع (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_source_insight_results_source_id"
        ON "source_insight_results" ("source_id")
    `);

    // ۴) جدول جدید network_report_results — گزارش دوره‌ای سطح شبکه.
    //    `network_id` ارجاع مفهومی به networks.id (integer ساده، بدون FK سخت).
    //    `report` (jsonb) بدنهٔ کامل گزارش را نگه می‌دارد؛ period_start/period_end
    //    بازهٔ زمانی گزارش را مشخص می‌کنند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "network_report_results" (
        "id" SERIAL NOT NULL,
        "network_id" integer NOT NULL,
        "analysis_run_id" integer,
        "prompt_version_id" integer,
        "model" character varying,
        "report" jsonb,
        "period_start" TIMESTAMP,
        "period_end" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_network_report_results_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزوده‌های همین مهاجرت حذف می‌شوند (Requirement 13.4).
    // ترتیب معکوس up: ابتدا indexها، سپس جدول‌ها (به ترتیب معکوس ساخت).

    // ۴) حذف network_report_results.
    await queryRunner.query(
      `DROP TABLE IF EXISTS "network_report_results"`,
    );

    // ۳) حذف index و سپس جدول source_insight_results.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_source_insight_results_source_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "source_insight_results"`,
    );

    // ۲) حذف index و سپس جدول content_analysis_results.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_content_analysis_results_content_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "content_analysis_results"`,
    );

    // ۱) حذف جدول analysis_runs.
    await queryRunner.query(`DROP TABLE IF EXISTS "analysis_runs"`);
  }
}
