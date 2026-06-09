import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — backfill دادهٔ موجود (design §5).
 *
 * برای هر `page` که هنوز `micro_media_id` ندارد، یک `micro_media` متناظر ساخته و
 * page به آن وصل می‌شود. **idempotent:** تنها pageهای بدون `micro_media_id`
 * پردازش می‌شوند؛ اجرای دوباره چیزی تکراری نمی‌سازد (Correctness Property 1).
 *
 * page به‌عنوان حساب پلتفرمیِ اولِ آن میکرورسانه علامت می‌خورد (`is_primary=true`).
 * هیچ دادهٔ legacy حذف نمی‌شود.
 */
export class BackfillMicroMediaFromPages1740300000000
  implements MigrationInterface
{
  name = 'BackfillMicroMediaFromPages1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        p RECORD;
        new_id integer;
      BEGIN
        FOR p IN
          SELECT * FROM "pages" WHERE "micro_media_id" IS NULL
        LOOP
          INSERT INTO "micro_media" (
            "name", "activity_domain", "country", "nationality",
            "language", "religion", "gender", "age_group",
            "topic_cluster_id", "status"
          ) VALUES (
            COALESCE(NULLIF(p."name", ''), p."username", 'micro_media_' || p."id"),
            p."category", p."country", p."nationality",
            p."language", p."religion", p."gender", p."age_range",
            p."cluster_id", 'active'
          )
          RETURNING "id" INTO new_id;

          UPDATE "pages"
            SET "micro_media_id" = new_id, "is_primary" = true
            WHERE "id" = p."id";
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت محتاطانه: تنها micro_mediaهایی که این backfill ساخته (و تنها یک page
    // به آن‌ها اشاره می‌کند) حذف می‌شوند و لینک page پاک می‌شود. چون امکان تشخیص
    // قطعی منشأ وجود ندارد، down عمداً محافظه‌کارانه فقط لینک‌ها را پاک نمی‌کند تا
    // داده‌ای از دست نرود؛ حذف خود رکوردهای micro_media به مهاجرت‌های ساختاری
    // (CreateMicroMedia.down) واگذار می‌شود. این down صرفاً no-op امن است.
    // (هیچ دادهٔ legacy در up تغییر نکرده جز افزودن micro_media_id که در مهاجرت
    //  AddMicroMediaIdToPages.down حذف می‌شود.)
    return;
  }
}
