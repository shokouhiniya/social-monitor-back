import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۳ — Auth/Users + Audit (Requirement 11.1–11.5 / 13.2).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - هیچ جدول/ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *  - تنها ستون‌های nullable جدید به جدول موجود `users` افزوده می‌شوند:
 *      `role` (varchar، با مقدار پیش‌فرض `'viewer'`)،
 *      `username` (varchar nullable — برای login)،
 *      `password_hash` (varchar nullable — هش رمز عبور، نه خود رمز).
 *    ستون موجود `phone` (unique/NOT NULL) و سایر ستون‌های legacy دست‌نخورده
 *    باقی می‌مانند تا ماژول legacy `UserModule` بدون تغییر کار کند (Requirement 1.6).
 *  - یک index یکتای جزئی روی `username` افزوده می‌شود که تنها رکوردهای دارای
 *    username را پوشش می‌دهد (`WHERE username IS NOT NULL`)؛ بنابراین رکوردهای
 *    موجود با `username = NULL` تداخلی ایجاد نمی‌کنند.
 *  - جدول جدید `audit_logs` برای ثبت اقدام‌های حساس ساخته می‌شود
 *    (Requirement 11.5).
 *
 * `down()` تنها افزوده‌های همین مهاجرت را حذف می‌کند و بر دادهٔ تولید از
 * پیش‌موجود (ستون‌ها و رکوردهای قبلی `users`) اثری نمی‌گذارد (Requirement 13.4)؛
 * به‌گونه‌ای که `up()` سپس `down()` schema را دقیقاً به وضعیت پیش از `up()`
 * بازگرداند (Requirement 13.3).
 *
 * timestamp این مهاجرت (۱۷۳۹۲۰۰۰۰۰۰۰۰) عمداً پس از
 * `Phase2CollectionRun1739100000000` انتخاب شده تا ترتیب اجرای مهاجرت‌ها حفظ
 * شود. ستون‌های افزوده‌شده باید دقیقاً با موجودیت‌های `User` و `AuditLog`
 * هم‌خوان بمانند.
 */
export class Phase3AuthAudit1739200000000 implements MigrationInterface {
  name = 'Phase3AuthAudit1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ۱) افزودن ستون‌های nullable جدید به جدول موجود `users` (افزایشی).
    //    `role` با DEFAULT 'viewer' افزوده می‌شود تا رکوردهای موجود نقش معتبر
    //    پیش‌فرض بگیرند، اما ستون nullable می‌ماند (مطابق طراحی افزایشی).
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" character varying DEFAULT 'viewer'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" character varying`,
    );

    // backfill مقدار role برای رکوردهای موجودی که پیش از افزودن DEFAULT درج
    // شده‌اند و ممکن است NULL باشند (idempotent و امن).
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'viewer' WHERE "role" IS NULL`,
    );

    // ۲) index یکتای جزئی روی username (تنها رکوردهای غیر-NULL).
    //    رکوردهای legacy که username ندارند (NULL) از این محدودیت معاف‌اند.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_username"
         ON "users" ("username") WHERE "username" IS NOT NULL`,
    );

    // ۳) جدول جدید audit_logs (Requirement 11.5). `actor_user_id` به users اشاره
    //    می‌کند با ON DELETE SET NULL تا حذف یک کاربر، رکوردهای ممیزی را تخریب
    //    نکند. `entity_id` به‌صورت varchar nullable نگه داشته می‌شود تا با انواع
    //    مختلف شناسهٔ موجودیت سازگار بماند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" SERIAL NOT NULL,
        "actor_user_id" integer,
        "action" character varying NOT NULL,
        "entity_type" character varying,
        "entity_id" character varying,
        "meta" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    // FK افزایشی به users (idempotent — وجود constraint بررسی می‌شود).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_audit_logs_actor_user_id'
        ) THEN
          ALTER TABLE "audit_logs"
            ADD CONSTRAINT "FK_audit_logs_actor_user_id"
            FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // index روی actor_user_id برای واکشی سریع تاریخچهٔ اقدام‌های یک کاربر.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor_user_id"
        ON "audit_logs" ("actor_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزوده‌های همین مهاجرت حذف می‌شوند (Requirement 13.4).
    // ترتیب معکوس up: ابتدا audit_logs، سپس index و ستون‌های users.

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_actor_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "FK_audit_logs_actor_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);

    // حذف index یکتای username و ستون‌های افزوده‌شده به users.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_username"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "username"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
  }
}
