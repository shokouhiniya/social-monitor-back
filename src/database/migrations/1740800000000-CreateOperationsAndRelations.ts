import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — جدول‌های `operations`,
 * `operation_media`, `operation_outputs` (design §3.8، تصمیم ۴). افزایشی.
 *
 * در سطح HTTP زیر `/campaigns` ارائه می‌شوند (تداخل صفر با `/operations/*` legacy)
 * اما در UI «عملیات» نامیده می‌شوند. `operation_media` UNIQUE(operation, media).
 */
export class CreateOperationsAndRelations1740800000000
  implements MigrationInterface
{
  name = 'CreateOperationsAndRelations1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "operations" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "goal" text,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'draft',
        "owner_user_id" integer,
        "starts_at" TIMESTAMP,
        "ends_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "operation_media" (
        "id" SERIAL NOT NULL,
        "operation_id" integer NOT NULL,
        "micro_media_id" integer NOT NULL,
        "planned_action" text,
        "expected_output" text,
        "actual_output" text,
        "status" character varying NOT NULL DEFAULT 'selected',
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operation_media_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_media_op_media"
        ON "operation_media" ("operation_id", "micro_media_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "operation_outputs" (
        "id" SERIAL NOT NULL,
        "operation_id" integer NOT NULL,
        "micro_media_id" integer,
        "page_id" integer,
        "task_id" integer,
        "output_type" character varying NOT NULL DEFAULT 'other',
        "output_url" character varying,
        "description" text,
        "published_at" TIMESTAMP,
        "views" integer,
        "likes" integer,
        "comments" integer,
        "shares" integer,
        "engagement" double precision,
        "captured_at" TIMESTAMP,
        "source" character varying NOT NULL DEFAULT 'manual',
        "created_by_user_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operation_outputs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_operation_outputs_operation"
        ON "operation_outputs" ("operation_id")
    `);

    // FKها
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_operation_media_operation_id') THEN
          ALTER TABLE "operation_media" ADD CONSTRAINT "FK_operation_media_operation_id"
            FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_operation_media_micro_media_id') THEN
          ALTER TABLE "operation_media" ADD CONSTRAINT "FK_operation_media_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_operation_outputs_operation_id') THEN
          ALTER TABLE "operation_outputs" ADD CONSTRAINT "FK_operation_outputs_operation_id"
            FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_operation_outputs_micro_media_id') THEN
          ALTER TABLE "operation_outputs" ADD CONSTRAINT "FK_operation_outputs_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_operation_outputs_page_id') THEN
          ALTER TABLE "operation_outputs" ADD CONSTRAINT "FK_operation_outputs_page_id"
            FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "operation_outputs" DROP CONSTRAINT IF EXISTS "FK_operation_outputs_page_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operation_outputs" DROP CONSTRAINT IF EXISTS "FK_operation_outputs_micro_media_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operation_outputs" DROP CONSTRAINT IF EXISTS "FK_operation_outputs_operation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operation_media" DROP CONSTRAINT IF EXISTS "FK_operation_media_micro_media_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operation_media" DROP CONSTRAINT IF EXISTS "FK_operation_media_operation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_operation_outputs_operation"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "operation_outputs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operation_media_op_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operation_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operations"`);
  }
}
