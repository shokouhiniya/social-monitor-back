import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * افزودن ستون `key` (slug پایدار) به جدول `definitions` و backfill کلید سکوهای
 * اولیه تا با مقدار ستون `pages.platform` (انگلیسی) تطبیق یابند. افزایشی.
 */
export class AddKeyToDefinitions1741100000000 implements MigrationInterface {
  name = 'AddKeyToDefinitions1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "definitions" ADD COLUMN IF NOT EXISTS "key" character varying(64)`,
    );

    // backfill کلید سکوهای اولیه بر اساس عنوان فارسی.
    const map: Array<[string, string]> = [
      ['اینستاگرام', 'instagram'],
      ['تلگرام', 'telegram'],
      ['توئیتر', 'twitter'],
      ['بله', 'bale'],
      ['ایتا', 'eita'],
      ['روبیکا', 'rubika'],
      ['روبینو', 'rubino'],
    ];
    for (const [title, key] of map) {
      await queryRunner.query(
        `UPDATE "definitions" SET "key" = $1 WHERE "type" = 'platform' AND "title" = $2 AND ("key" IS NULL OR "key" = '')`,
        [key, title],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "definitions" DROP COLUMN IF EXISTS "key"`);
  }
}
