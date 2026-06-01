import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۲ — جدول‌های `networks` و `actors` و ستون‌های nullable روی `pages`.
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - جدول‌های موجود حفظ می‌شوند؛ هیچ ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *  - جدول‌های جدید `networks` و `actors` افزوده می‌شوند.
 *  - تنها ستون‌های nullable به جدول موجود `pages` افزوده می‌شوند:
 *    `network_id` (FK → networks)، `actor_id` (FK → actors)، `profile_url`.
 *  - یک network پیش‌فرض seed می‌شود و `pages.network_id` برای رکوردهای موجود
 *    با id همان network پیش‌فرض backfill می‌شود.
 *
 * `down()` تنها افزوده‌های همین مهاجرت را حذف می‌کند و بر دادهٔ تولید از پیش‌موجود
 * (ستون‌ها و رکوردهای قبلی `pages`) اثری نمی‌گذارد (Requirement 13.4). به‌گونه‌ای که
 * اجرای `up()` و سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3).
 *
 * SQL خام (queryRunner.query) برای کنترل صریح و قابلیت حمل استفاده شده و در جای
 * معقول با `IF NOT EXISTS` / `IF EXISTS` به‌صورت idempotent-safe نوشته شده است.
 */
export class Phase2NetworksActors1739000000000 implements MigrationInterface {
  name = 'Phase2NetworksActors1739000000000';

  /** slug ثابت network پیش‌فرض؛ در up (seed/backfill) و down (cleanup) مشترک است. */
  private static readonly DEFAULT_NETWORK_SLUG = 'default';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ۱) جدول جدید networks — id, name, slug, description, default_language,
    //    target_narrative, is_active (+ ستون‌های زمانی استاندارد).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "networks" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "default_language" character varying,
        "target_narrative" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_networks_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_networks_id" PRIMARY KEY ("id")
      )
    `);

    // ۲) جدول جدید actors — id, name, type, description, country, language,
    //    metadata (jsonb) (+ ستون‌های زمانی استاندارد). در فاز اول فقط schema.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "actors" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying,
        "description" text,
        "country" character varying,
        "language" character varying,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_actors_id" PRIMARY KEY ("id")
      )
    `);

    // ۳) افزودن ستون‌های nullable به جدول موجود pages (افزایشی — بدون تغییر ستون‌های قبلی).
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "network_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "actor_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "profile_url" character varying`,
    );

    // ۴) افزودن FKها به‌صورت idempotent. در Postgres برای ADD CONSTRAINT گزینهٔ
    //    IF NOT EXISTS وجود ندارد، پس وجود constraint را در pg_constraint چک می‌کنیم.
    //    onDelete = SET NULL تا حذف یک network/actor رکوردهای pages را تخریب نکند.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pages_network_id'
        ) THEN
          ALTER TABLE "pages"
            ADD CONSTRAINT "FK_pages_network_id"
            FOREIGN KEY ("network_id") REFERENCES "networks"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pages_actor_id'
        ) THEN
          ALTER TABLE "pages"
            ADD CONSTRAINT "FK_pages_actor_id"
            FOREIGN KEY ("actor_id") REFERENCES "actors"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // ۵) seed یک network پیش‌فرض (idempotent از طریق UNIQUE روی slug).
    await queryRunner.query(
      `
      INSERT INTO "networks" ("name", "slug", "description", "default_language", "is_active")
      VALUES ('شبکه پیش‌فرض', $1, 'شبکهٔ عملیاتی پیش‌فرض (ساخته‌شده توسط مهاجرت فاز ۲)', 'fa', true)
      ON CONFLICT ("slug") DO NOTHING
      `,
      [Phase2NetworksActors1739000000000.DEFAULT_NETWORK_SLUG],
    );

    // ۶) backfill: رکوردهای موجود pages که network ندارند را به network پیش‌فرض متصل کن.
    await queryRunner.query(
      `
      UPDATE "pages"
      SET "network_id" = (SELECT "id" FROM "networks" WHERE "slug" = $1 LIMIT 1)
      WHERE "network_id" IS NULL
      `,
      [Phase2NetworksActors1739000000000.DEFAULT_NETWORK_SLUG],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزوده‌های همین مهاجرت حذف می‌شوند (Requirement 13.4).
    // ترتیب معکوس up: ابتدا FKها، سپس ستون‌ها، سپس جدول‌های جدید.

    // ۱) حذف FKهای افزوده‌شده روی pages (idempotent).
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT IF EXISTS "FK_pages_actor_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT IF EXISTS "FK_pages_network_id"`,
    );

    // ۲) حذف ستون‌های nullable افزوده‌شده به pages. drop کردن این ستون‌ها داده‌ای را
    //    که خودِ این مهاجرت اضافه کرده (مقدار network_id حاصل از backfill) برمی‌گرداند
    //    و به هیچ ستون از پیش‌موجود pages دست نمی‌زند.
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "profile_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "actor_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "network_id"`,
    );

    // ۳) حذف جدول‌های جدید (شامل network پیش‌فرض seed‌شده).
    await queryRunner.query(`DROP TABLE IF EXISTS "actors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "networks"`);
  }
}
