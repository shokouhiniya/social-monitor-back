import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — nullable کردن `interactions.page_id`
 * (design §3.6). تغییر widening و غیرتخریبی: تعامل‌های micro_media-محور لزوماً
 * به یک `page` خاص وصل نیستند، پس ستون legacy `page_id` نباید NOT NULL بماند.
 *
 * هیچ داده‌ای حذف نمی‌شود؛ رکوردهای موجود دست‌نخورده می‌مانند.
 */
export class MakeInteractionsPageIdNullable1740900000000
  implements MigrationInterface
{
  name = 'MakeInteractionsPageIdNullable1740900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interactions" ALTER COLUMN "page_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگردانی NOT NULL تنها در صورتی امن است که هیچ رکورد با page_id NULL وجود
    // نداشته باشد؛ برای جلوگیری از شکست، down محتاطانه تلاش می‌کند و در صورت وجود
    // NULL، عملیات را رها می‌کند (no-op امن).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM "interactions" WHERE "page_id" IS NULL) THEN
          ALTER TABLE "interactions" ALTER COLUMN "page_id" SET NOT NULL;
        END IF;
      END $$;
    `);
  }
}
