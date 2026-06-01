import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۴ — جداول Job Center (Requirement 13.2 / طراحی §۶.۷).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - هیچ جدول/ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *  - سه جدول جدید افزوده می‌شوند:
 *      `jobs` — هر اجرای دسته‌ای (refresh/تحلیل) با نوع، دامنه، config و
 *        شمارش‌های total/completed/failed. شناسهٔ آن `uuid` است (طراحی §۶.۷) تا
 *        با شناسه‌های opaque در API و polling سازگار باشد.
 *      `job_tasks` — واحدهای کاری زیرمجموعهٔ هر Job با FK به `jobs(id)`
 *        (ON DELETE CASCADE) تا حذف یک Job، taskهای آن را هم پاک کند. نوع کار
 *        یکی از fetch|analyze|insight|dashboard است.
 *      `job_logs` — لاگ‌های هر Job (info|success|error) با FK به `jobs(id)`
 *        (ON DELETE CASCADE).
 *
 * وضعیت‌های `jobs` و `job_tasks` به‌صورت varchar ذخیره می‌شوند
 * (pending|running|succeeded|failed|cancelled|skipped)؛ ماشین وضعیت در سرویس
 * (task 7.2) پیاده می‌شود، نه در schema.
 *
 * شناسهٔ `jobs.id` با `gen_random_uuid()` مقداردهی می‌شود؛ برای اطمینان از در
 * دسترس بودن این تابع، در ابتدای `up()` افزونهٔ `pgcrypto` به‌صورت
 * `CREATE EXTENSION IF NOT EXISTS` فعال می‌شود. این افزونه در `down()` حذف
 * **نمی‌شود** (ممکن است سایر اشیاء دیتابیس به آن وابسته باشند).
 *
 * indexها روی `job_tasks.job_id`, `job_tasks.status` و `job_logs.job_id`
 * افزوده می‌شوند (طراحی §۱۲.۳).
 *
 * `down()` تنها افزوده‌های همین مهاجرت را حذف می‌کند (Requirement 13.4)؛ به‌گونه‌ای
 * که اجرای `up()` و سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3). ترتیب حذف معکوس وابستگی‌هاست: ابتدا indexها و FKها، سپس
 * `job_logs`, `job_tasks`, `jobs` به ترتیب معکوس ساخت.
 *
 * timestamp این مهاجرت (۱۷۳۹۵۰۰۰۰۰۰۰۰) عمداً پس از
 * `Phase3AnalysisResults1739400000000` انتخاب شده تا ترتیب اجرای مهاجرت‌ها حفظ شود.
 * موجودیت‌های هم‌خوان با این جدول‌ها در task بعدی (۷.۲ JobsModule) ساخته می‌شوند؛
 * این task تنها migration است و entity ای اضافه نمی‌کند.
 *
 * SQL خام (queryRunner.query) برای کنترل صریح و قابلیت حمل استفاده شده و در جای
 * معقول با `IF NOT EXISTS` / `IF EXISTS` به‌صورت idempotent-safe نوشته شده است.
 */
export class Phase4Jobs1739500000000 implements MigrationInterface {
  name = 'Phase4Jobs1739500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ۰) اطمینان از در دسترس بودن gen_random_uuid() (در pgcrypto؛ روی Postgres 13+
    //    به‌صورت داخلی نیز موجود است). افزایشی و idempotent-safe؛ در down حذف نمی‌شود.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ۱) جدول جدید jobs — هر اجرای دسته‌ای. شناسه uuid با مقدار پیش‌فرض تولیدشده.
    //    `config` (jsonb nullable) پارامترهای اجرا را نگه می‌دارد؛ شمارش‌های
    //    total/completed/failed با DEFAULT 0 آغاز می‌شوند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL,
        "status" character varying NOT NULL,
        "scope" character varying,
        "config" jsonb,
        "total_tasks" integer NOT NULL DEFAULT 0,
        "completed_tasks" integer NOT NULL DEFAULT 0,
        "failed_tasks" integer NOT NULL DEFAULT 0,
        "created_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        CONSTRAINT "PK_jobs_id" PRIMARY KEY ("id")
      )
    `);

    // ۲) جدول جدید job_tasks — واحدهای کاری هر Job. شناسه SERIAL (integer) برای سادگی.
    //    `job_id` (uuid) با FK به jobs(id) و ON DELETE CASCADE.
    //    `type` یکی از fetch|analyze|insight|dashboard است؛ `target_ref` ارجاع
    //    مفهومی به موجودیت هدف (مثلاً sourceId) را نگه می‌دارد.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_tasks" (
        "id" SERIAL NOT NULL,
        "job_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "target_ref" character varying,
        "status" character varying NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_tasks_id" PRIMARY KEY ("id")
      )
    `);

    // FK افزایشی job_tasks.job_id → jobs.id با ON DELETE CASCADE (idempotent —
    // وجود constraint بررسی می‌شود؛ Postgres برای ADD CONSTRAINT گزینهٔ
    // IF NOT EXISTS ندارد).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_job_tasks_job_id'
        ) THEN
          ALTER TABLE "job_tasks"
            ADD CONSTRAINT "FK_job_tasks_job_id"
            FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // indexها روی job_id و status برای واکشی/فیلتر سریع taskهای یک Job (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_job_tasks_job_id"
        ON "job_tasks" ("job_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_job_tasks_status"
        ON "job_tasks" ("status")
    `);

    // ۳) جدول جدید job_logs — لاگ‌های هر Job. شناسه SERIAL (integer).
    //    `job_id` (uuid) با FK به jobs(id) و ON DELETE CASCADE.
    //    `level` یکی از info|success|error است.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_logs" (
        "id" SERIAL NOT NULL,
        "job_id" uuid NOT NULL,
        "level" character varying NOT NULL,
        "message" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_logs_id" PRIMARY KEY ("id")
      )
    `);

    // FK افزایشی job_logs.job_id → jobs.id با ON DELETE CASCADE (idempotent).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_job_logs_job_id'
        ) THEN
          ALTER TABLE "job_logs"
            ADD CONSTRAINT "FK_job_logs_job_id"
            FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // index روی job_id برای واکشی سریع لاگ‌های یک Job (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_job_logs_job_id"
        ON "job_logs" ("job_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزوده‌های همین مهاجرت حذف می‌شوند (Requirement 13.4).
    // ترتیب معکوس up: ابتدا index/FK، سپس جدول‌ها به ترتیب معکوس وابستگی.
    // افزونهٔ pgcrypto عمداً حذف نمی‌شود (ممکن است وابستگی‌های دیگری داشته باشد).

    // ۳) حذف index و FK و سپس جدول job_logs.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_logs_job_id"`);
    await queryRunner.query(
      `ALTER TABLE "job_logs" DROP CONSTRAINT IF EXISTS "FK_job_logs_job_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "job_logs"`);

    // ۲) حذف indexها و FK و سپس جدول job_tasks.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_tasks_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_tasks_job_id"`);
    await queryRunner.query(
      `ALTER TABLE "job_tasks" DROP CONSTRAINT IF EXISTS "FK_job_tasks_job_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "job_tasks"`);

    // ۱) حذف جدول jobs (آخرین، چون job_tasks و job_logs به آن وابسته بودند).
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs"`);
  }
}
