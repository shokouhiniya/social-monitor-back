import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — جدول‌های `media_score_indicators` و
 * `media_score_records` + seed ۷ شاخص اولیهٔ PRD (design §3.5).
 *
 * `media_score_records` UNIQUE(micro_media_id, indicator_id, period_start) دارد
 * تا برای هر دوره حداکثر یک رکورد معتبر باشد (Correctness Property 6). FKها:
 * micro_media (CASCADE) و indicator (CASCADE).
 */
export class CreateMediaScoreIndicatorsAndRecords1740500000000
  implements MigrationInterface
{
  name = 'CreateMediaScoreIndicatorsAndRecords1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_score_indicators" (
        "id" SERIAL NOT NULL,
        "key" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "min_value" double precision NOT NULL DEFAULT 0,
        "max_value" double precision NOT NULL DEFAULT 100,
        "weight" double precision NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_media_score_indicators_key" UNIQUE ("key"),
        CONSTRAINT "PK_media_score_indicators_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_score_records" (
        "id" SERIAL NOT NULL,
        "micro_media_id" integer NOT NULL,
        "indicator_id" integer NOT NULL,
        "value" double precision NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date,
        "scored_by_user_id" integer,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_score_records_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_media_score_records_media_indicator_period"
        ON "media_score_records" ("micro_media_id", "indicator_id", "period_start")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_media_score_records_media"
        ON "media_score_records" ("micro_media_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_media_score_records_micro_media_id'
        ) THEN
          ALTER TABLE "media_score_records"
            ADD CONSTRAINT "FK_media_score_records_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_media_score_records_indicator_id'
        ) THEN
          ALTER TABLE "media_score_records"
            ADD CONSTRAINT "FK_media_score_records_indicator_id"
            FOREIGN KEY ("indicator_id") REFERENCES "media_score_indicators"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // seed ۷ شاخص اولیهٔ PRD (idempotent از طریق UNIQUE روی key).
    await queryRunner.query(`
      INSERT INTO "media_score_indicators" ("key", "title", "min_value", "max_value", "weight", "sort_order")
      VALUES
        ('consumption_system_status', 'وضعیت در نظام مصرف', 0, 100, 1, 1),
        ('active_actor_count',        'تعداد بازیگر فعال',   0, 100, 1, 2),
        ('cohesion_level',            'کمربستگی',            0, 100, 1, 3),
        ('dependency_level',          'وابستگی',             0, 100, 1, 4),
        ('interaction_collaboration', 'نوع تعامل و همکاری',  0, 100, 1, 5),
        ('index_production_capacity', 'توان تولید شاخص',     0, 100, 1, 6),
        ('income_level',              'درآمد',               0, 100, 1, 7)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_score_records" DROP CONSTRAINT IF EXISTS "FK_media_score_records_indicator_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_score_records" DROP CONSTRAINT IF EXISTS "FK_media_score_records_micro_media_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_media_score_records_media"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_media_score_records_media_indicator_period"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "media_score_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "media_score_indicators"`);
  }
}
