import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — گسترش افزایشی جدول موجود
 * `interactions` (design §3.6، تصمیم ۵). هیچ ستون موجودی تغییر/حذف نمی‌شود؛ تنها
 * ستون‌های nullable جدید افزوده می‌شوند تا تعامل بتواند به micro_media/hub/
 * operation/task وصل شود و قاعدهٔ «فعال بودن» از `interaction_date` محاسبه شود.
 *
 * FKها همگی نرم با ON DELETE SET NULL تا حذف موجودیت‌های مرتبط، رکورد تعامل را
 * تخریب نکند.
 */
export class ExtendInteractionsForMicroMedia1740600000000
  implements MigrationInterface
{
  name = 'ExtendInteractionsForMicroMedia1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "micro_media_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "hub_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "operation_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "task_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "interaction_date" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "owner_user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "summary" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "next_action" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "tags" jsonb`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interactions_micro_media_id"
        ON "interactions" ("micro_media_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interactions_interaction_date"
        ON "interactions" ("interaction_date")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_interactions_micro_media_id'
        ) THEN
          ALTER TABLE "interactions"
            ADD CONSTRAINT "FK_interactions_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP CONSTRAINT IF EXISTS "FK_interactions_micro_media_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_interactions_interaction_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_interactions_micro_media_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "tags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "next_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "summary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "owner_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "interaction_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "task_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "operation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "hub_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interactions" DROP COLUMN IF EXISTS "micro_media_id"`,
    );
  }
}
