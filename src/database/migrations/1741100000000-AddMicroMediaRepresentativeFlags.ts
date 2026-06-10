import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزودن پرچم‌های «نماینده» به جدول `micro_media`.
 *
 * در راهبرد جدید، واحد تحلیل «میکرورسانه» است (نه page). برای هر خوشه و هر هویت
 * می‌توان یک یا چند میکرورسانه را به‌عنوان «نماینده» انتخاب کرد. چون مفهوم خوشه و
 * هویت کاملاً مستقل‌اند، دو پرچم مجزا اضافه می‌شود:
 *  - `is_cluster_representative`  → نمایندهٔ خوشهٔ موضوعی (`topic_cluster_id`).
 *  - `is_identity_representative` → نمایندهٔ هویت (`identity_title`).
 *
 * افزایشی و غیرتخریبی؛ هیچ ستون موجودی تغییر نمی‌کند. هر دو با `IF NOT EXISTS`
 * به‌صورت idempotent-safe افزوده می‌شوند.
 */
export class AddMicroMediaRepresentativeFlags1741100000000
  implements MigrationInterface
{
  name = 'AddMicroMediaRepresentativeFlags1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "micro_media" ADD COLUMN IF NOT EXISTS "is_cluster_representative" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "micro_media" ADD COLUMN IF NOT EXISTS "is_identity_representative" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_micro_media_is_cluster_representative"
        ON "micro_media" ("is_cluster_representative")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_micro_media_is_identity_representative"
        ON "micro_media" ("is_identity_representative")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_micro_media_is_identity_representative"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_micro_media_is_cluster_representative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "micro_media" DROP COLUMN IF EXISTS "is_identity_representative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "micro_media" DROP COLUMN IF EXISTS "is_cluster_representative"`,
    );
  }
}
