import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت ساخت جدول `definitions` (تعاریف مرجع هویت/سکو) + seed لیست‌های اولیه.
 * افزایشی و غیرتخریبی. خوشه‌ها در جدول جداگانهٔ `clusters` مدیریت می‌شوند.
 */
export class CreateDefinitions1741000000000 implements MigrationInterface {
  name = 'CreateDefinitions1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "definitions" (
        "id" SERIAL NOT NULL,
        "type" character varying(32) NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "icon" character varying(128),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_definitions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_definitions_type" ON "definitions" ("type")
    `);

    // --- seed هویت‌ها (فقط اگر هیچ هویتی موجود نباشد) ---
    const identities: Array<[string, string]> = [
      ['ژورنالیست و خبرنگار', 'فردی که حرفه‌اش جمع‌آوری، تایید و انتشار اخبار با نگاه حرفه‌ای است.'],
      ['بلاگر لایف‌استایل', 'شخصی که محوریت صفحه‌اش نمایش جزئیات زندگی شخصی و سبک روزمرگی اوست.'],
      ['اینفلوئنسر و چهره مجازی', 'کسی که قدرت اثرگذاری و شهرتش را صرفاً از بستر رسانه‌های اجتماعی کسب کرده است.'],
      ['واینر و طنزپرداز', 'کمدینی که در قالب کلیپ‌های کوتاه تولید محتوای سرگرم‌کننده می‌کند.'],
      ['روحانی و مبلغ', 'فرد تحصیل‌کرده علوم دینی که به تبیین شریعت و هدایت مذهبی می‌پردازد.'],
      ['مداح و ذاکر', 'هنرمند مذهبی که از طریق صوت و لحن به ذکر مصیبت یا مدح پیشوایان دینی می‌پردازد.'],
      ['استاد دانشگاه و پژوهشگر', 'فرد دارای مدارج آکادمیک که محتوای علمی و تحلیلی تخصصی ارائه می‌دهد.'],
      ['فعال مدنی و سیاسی', 'شخصی که داوطلبانه برای تغییرات اجتماعی، سیاسی یا محیط‌زیستی تلاش و مطالبه‌گری می‌کند.'],
      ['هنرمند و خواننده', 'فردی که خارج از فضای مجازی در یکی از شاخه‌های هنری به‌صورت حرفه‌ای شناخته شده است.'],
      ['کودک‌بلاگر و والد‌بلاگر', 'صفحاتی که محوریت آن‌ها نمایش مستقیم زیست کودک یا تجربیات والدین است.'],
      ['حجاب‌بلاگر', 'اینفلوئنسری که تمرکز اصلی‌اش ترویج و نمایش استایل‌های پوشش اسلامی و چادر است.'],
      ['متخصص و کارشناس', 'فردی که صاحب فن یا مهارتی (مثل وکالت یا طبابت) است و دانشش را عرضه می‌کند.'],
      ['رسانه شرکتی و سازمانی', 'صفحه‌ای که هویت یک برند، نهاد یا ارگان دولتی/خصوصی را نمایندگی می‌کند.'],
      ['ورزشکار', 'قهرمانان ملی یا حرفه‌ای که صفحه شخصی‌شان را برای ارتباط با هواداران دارند.'],
      ['توریست و گردشگر', 'صفحه‌ای که ضمن بازدید از مکان‌های مختلف به انتشار محتوا می‌پردازد.'],
    ];

    const identityCount = await queryRunner.query(
      `SELECT COUNT(*)::int AS c FROM "definitions" WHERE "type" = 'identity'`,
    );
    if (!identityCount?.[0] || identityCount[0].c === 0) {
      let i = 0;
      for (const [title, description] of identities) {
        await queryRunner.query(
          `INSERT INTO "definitions" ("type", "title", "description", "sort_order")
           VALUES ('identity', $1, $2, $3)`,
          [title, description, i],
        );
        i += 1;
      }
    }

    // --- seed سکوها (فقط اگر هیچ سکویی موجود نباشد) ---
    const platforms: Array<[string, string | null]> = [
      ['اینستاگرام', 'mdi:instagram'],
      ['تلگرام', 'mdi:telegram'],
      ['توئیتر', 'mdi:twitter'],
      ['بله', null],
      ['ایتا', null],
      ['روبیکا', null],
      ['روبینو', null],
    ];

    const platformCount = await queryRunner.query(
      `SELECT COUNT(*)::int AS c FROM "definitions" WHERE "type" = 'platform'`,
    );
    if (!platformCount?.[0] || platformCount[0].c === 0) {
      let i = 0;
      for (const [title, icon] of platforms) {
        await queryRunner.query(
          `INSERT INTO "definitions" ("type", "title", "icon", "sort_order")
           VALUES ('platform', $1, $2, $3)`,
          [title, icon, i],
        );
        i += 1;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_definitions_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "definitions"`);
  }
}
