import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۲ — جدول جدید `collection_run` (Requirement 4.5 / 13.2).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است:
 *  - تنها یک جدول جدید `collection_run` افزوده می‌شود.
 *  - هیچ جدول/ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *
 * جدول `collection_run` خلاصهٔ هر اجرای واکشی را نگه می‌دارد: شناسهٔ منبع،
 * پلتفرم، وضعیت، و شمارش‌های fetched/new/updated/error/skipped به‌همراه پیام خطا
 * (nullable) و خلاصهٔ سبک payload (`raw_payload_summary` — Requirement 4.4) و
 * زمان‌های شروع/پایان.
 *
 * `down()` تنها افزودهٔ همین مهاجرت (جدول `collection_run`) را حذف می‌کند و بر
 * دادهٔ تولید از پیش‌موجود اثری نمی‌گذارد (Requirement 13.4)؛ به‌گونه‌ای که
 * `up()` سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3).
 *
 * timestamp این مهاجرت (۱۷۳۹۱۰۰۰۰۰۰۰۰) عمداً پس از
 * `Phase2NetworksActors1739000000000` انتخاب شده تا ترتیب اجرای مهاجرت‌ها حفظ
 * شود. ستون‌ها باید دقیقاً با entity `CollectionRun` هم‌خوان بمانند.
 */
export class Phase2CollectionRun1739100000000 implements MigrationInterface {
  name = 'Phase2CollectionRun1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collection_run" (
        "id" SERIAL NOT NULL,
        "source_id" integer NOT NULL,
        "platform" character varying NOT NULL,
        "status" character varying NOT NULL,
        "fetched_count" integer NOT NULL DEFAULT 0,
        "new_count" integer NOT NULL DEFAULT 0,
        "updated_count" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "skipped_count" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "raw_payload_summary" jsonb,
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collection_run_id" PRIMARY KEY ("id")
      )
    `);

    // index روی source_id برای واکشی سریع تاریخچهٔ اجرای یک منبع (افزایشی).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_run_source_id"
        ON "collection_run" ("source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزودهٔ همین مهاجرت حذف می‌شود (Requirement 13.4).
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_collection_run_source_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "collection_run"`);
  }
}
