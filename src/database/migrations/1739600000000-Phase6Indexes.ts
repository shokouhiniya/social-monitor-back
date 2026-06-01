import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۶ — افزودن index روی ستون‌های پرکاربردِ join/filter
 * (Requirement 15.2 / طراحی §۱۲.۳ و جدول فازها §۶ — «فاز ۶: افزودن index ها»).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - هیچ جدول/ستونی ساخته، تغییر یا drop نمی‌شود.
 *  - تنها index روی ستون‌های *از پیش‌موجود* افزوده می‌شود تا endpointهای لیستی و
 *    queryهای تحلیلی (که با حدود ۱۰۰۰ منبع در هر محیط کار می‌کنند) سریع‌تر شوند.
 *
 * indexهای الزامی (Requirement 15.2):
 *  - `pages.network_id`     — join/filter منابع بر اساس شبکهٔ عملیاتی
 *                              (ستون در مهاجرت فاز ۲ افزوده شده است).
 *  - `posts.page_id`        — join پست‌ها به منبع و واکشی پست‌های یک منبع.
 *  - `posts.external_id`    — lookup/deduplication بر اساس شناسهٔ پلتفرم مبدأ.
 *  - `posts.published_at`   — مرتب‌سازی/بازهٔ زمانی در داشبورد و timelineها.
 *
 * indexهای کمکی پرکاربرد (طراحی §۱۲.۳ — تنها روی ستون‌هایی که در entity موجودند):
 *  - `posts.sentiment_score`, `posts.is_relevant`, `posts.post_type`
 *  - `pages.platform`, `pages.cluster_id`, `pages.is_representative`, `pages.is_active`
 *
 * همهٔ indexها با `CREATE INDEX IF NOT EXISTS` ساخته می‌شوند (idempotent-safe) و در
 * `down()` با `DROP INDEX IF EXISTS` به‌صورت کاملاً متقارن حذف می‌شوند. `down()`
 * تنها افزوده‌های همین مهاجرت را حذف می‌کند (Requirement 13.4)، به‌گونه‌ای که اجرای
 * `up()` و سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3).
 *
 * timestamp این مهاجرت (۱۷۳۹۶۰۰۰۰۰۰۰۰) عمداً پس از `Phase4Jobs1739500000000`
 * انتخاب شده تا ترتیب اجرای مهاجرت‌ها حفظ شود.
 *
 * SQL خام (queryRunner.query) برای کنترل صریح و قابلیت حمل استفاده شده است.
 */
export class Phase6Indexes1739600000000 implements MigrationInterface {
  name = 'Phase6Indexes1739600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── indexهای الزامی (Requirement 15.2) ──────────────────────────────────

    // pages.network_id — join/filter منابع بر اساس شبکه.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pages_network_id"
        ON "pages" ("network_id")
    `);

    // posts.page_id — join پست‌ها به منبع و واکشی پست‌های یک منبع.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_page_id"
        ON "posts" ("page_id")
    `);

    // posts.external_id — lookup/deduplication بر اساس شناسهٔ پلتفرم مبدأ.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_external_id"
        ON "posts" ("external_id")
    `);

    // posts.published_at — مرتب‌سازی/بازهٔ زمانی در داشبورد و timelineها.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_published_at"
        ON "posts" ("published_at")
    `);

    // ── indexهای کمکی پرکاربرد (طراحی §۱۲.۳) ────────────────────────────────

    // posts.sentiment_score — فیلتر/مرتب‌سازی بر اساس احساس.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_sentiment_score"
        ON "posts" ("sentiment_score")
    `);

    // posts.is_relevant — فیلتر پست‌های مرتبط در کانال‌های کلیدواژه‌محور.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_is_relevant"
        ON "posts" ("is_relevant")
    `);

    // posts.post_type — فیلتر بر اساس نوع محتوا (image/video/reel/...).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_post_type"
        ON "posts" ("post_type")
    `);

    // pages.platform — فیلتر منابع بر اساس پلتفرم.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pages_platform"
        ON "pages" ("platform")
    `);

    // pages.cluster_id — join/filter اعضای یک خوشه.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pages_cluster_id"
        ON "pages" ("cluster_id")
    `);

    // pages.is_representative — scope «نمایندگان شبکه» در داشبوردها.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pages_is_representative"
        ON "pages" ("is_representative")
    `);

    // pages.is_active — فیلتر منابع فعال.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pages_is_active"
        ON "pages" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها indexهای افزوده‌شده در همین مهاجرت حذف می‌شوند
    // (Requirement 13.4). ترتیب معکوس up.

    // indexهای کمکی pages.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_is_active"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pages_is_representative"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_cluster_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_platform"`);

    // indexهای کمکی posts.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_post_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_is_relevant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_sentiment_score"`);

    // indexهای الزامی (Requirement 15.2).
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_published_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_external_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_page_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_network_id"`);
  }
}
