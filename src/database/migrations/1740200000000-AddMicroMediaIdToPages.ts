import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — افزودن ستون‌های nullable به جدول
 * موجود `pages` (design §3.3، تصمیم ۱). افزایشی و غیرتخریبی؛ هیچ ستون موجودی
 * تغییر نمی‌کند. `pages` نقش «حساب پلتفرمی» زیر MicroMedia را می‌گیرد.
 *
 * `micro_media_id` → `micro_media.id` با ON DELETE SET NULL.
 */
export class AddMicroMediaIdToPages1740200000000
  implements MigrationInterface
{
  name = 'AddMicroMediaIdToPages1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "micro_media_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "is_primary" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pages_micro_media_id"
        ON "pages" ("micro_media_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pages_micro_media_id'
        ) THEN
          ALTER TABLE "pages"
            ADD CONSTRAINT "FK_pages_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT IF EXISTS "FK_pages_micro_media_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_micro_media_id"`);
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "last_synced_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "is_primary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN IF EXISTS "micro_media_id"`,
    );
  }
}
