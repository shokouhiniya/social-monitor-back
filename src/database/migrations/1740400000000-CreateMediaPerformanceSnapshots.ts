import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — جدول `media_performance_snapshots`
 * (design §3.4). افزایشی. سری‌زمانی دادهٔ عملکردی برای داشبورد رشد.
 *
 * `micro_media_id` → `micro_media.id` (CASCADE)؛ `page_id` → `pages.id` (SET NULL).
 */
export class CreateMediaPerformanceSnapshots1740400000000
  implements MigrationInterface
{
  name = 'CreateMediaPerformanceSnapshots1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_performance_snapshots" (
        "id" SERIAL NOT NULL,
        "micro_media_id" integer NOT NULL,
        "page_id" integer,
        "platform" character varying,
        "followers" integer,
        "views" integer,
        "likes" integer,
        "comments" integer,
        "shares" integer,
        "posts_count" integer,
        "content_count" integer,
        "engagement_rate" double precision,
        "growth_rate" double precision,
        "captured_at" TIMESTAMP NOT NULL,
        "source" character varying NOT NULL DEFAULT 'manual',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_performance_snapshots_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_media_perf_media_captured"
        ON "media_performance_snapshots" ("micro_media_id", "captured_at")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_media_perf_micro_media_id'
        ) THEN
          ALTER TABLE "media_performance_snapshots"
            ADD CONSTRAINT "FK_media_perf_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_media_perf_page_id'
        ) THEN
          ALTER TABLE "media_performance_snapshots"
            ADD CONSTRAINT "FK_media_perf_page_id"
            FOREIGN KEY ("page_id") REFERENCES "pages"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_performance_snapshots" DROP CONSTRAINT IF EXISTS "FK_media_perf_page_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_performance_snapshots" DROP CONSTRAINT IF EXISTS "FK_media_perf_micro_media_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_media_perf_media_captured"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "media_performance_snapshots"`,
    );
  }
}
