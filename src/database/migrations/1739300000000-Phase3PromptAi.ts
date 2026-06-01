import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت افزایشی فاز ۳ — لایهٔ Prompt/AI (Requirement 13.2 / طراحی §۶.۴).
 *
 * این مهاجرت کاملاً **غیرتخریبی و افزایشی** است (Requirement 13.2):
 *  - هیچ جدول/ستون موجودی تغییر نمی‌کند یا drop نمی‌شود.
 *  - سه جدول جدید افزوده می‌شوند:
 *      `prompt_definitions` — تعریف هر prompt (key یکتا، schema خروجی، فعال/غیرفعال).
 *      `prompt_versions` — نسخه‌های قالب هر prompt با FK به `prompt_definitions`
 *        (ON DELETE CASCADE) تا حذف یک تعریف، نسخه‌های آن را هم پاک کند.
 *      `ai_execution_logs` — ثبت هر اجرای مدل (موفق/ناموفق) با خروجی خام (طراحی §۱۱.۲).
 *
 * `down()` تنها افزوده‌های همین مهاجرت را حذف می‌کند (Requirement 13.4)؛ به‌گونه‌ای
 * که اجرای `up()` و سپس `down()` schema را دقیقاً به وضعیت پیش از `up()` بازگرداند
 * (Requirement 13.3). ترتیب حذف معکوس وابستگی‌هاست: ابتدا index/FK، سپس جدول‌ها.
 *
 * timestamp این مهاجرت (۱۷۳۹۳۰۰۰۰۰۰۰۰) عمداً پس از
 * `Phase3AuthAudit1739200000000` انتخاب شده تا ترتیب اجرای مهاجرت‌ها حفظ شود.
 * موجودیت‌های هم‌خوان با این جدول‌ها در taskهای بعدی (۵.۵ Prompts و ۵.۳ ai logs)
 * ساخته می‌شوند؛ این task تنها migration است و entity ای اضافه نمی‌کند.
 *
 * SQL خام (queryRunner.query) برای کنترل صریح و قابلیت حمل استفاده شده و در جای
 * معقول با `IF NOT EXISTS` / `IF EXISTS` به‌صورت idempotent-safe نوشته شده است.
 */
export class Phase3PromptAi1739300000000 implements MigrationInterface {
  name = 'Phase3PromptAi1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ۱) جدول جدید prompt_definitions — تعریف پایهٔ هر prompt.
    //    `key` یکتاست تا هر prompt با یک شناسهٔ پایدار قابل ارجاع باشد.
    //    `output_schema` (jsonb nullable) schema مورد انتظار خروجی مدل را نگه می‌دارد.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prompt_definitions" (
        "id" SERIAL NOT NULL,
        "key" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "category" character varying,
        "default_model" character varying,
        "output_schema" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_prompt_definitions_key" UNIQUE ("key"),
        CONSTRAINT "PK_prompt_definitions_id" PRIMARY KEY ("id")
      )
    `);

    // ۲) جدول جدید prompt_versions — نسخه‌های قالب هر prompt.
    //    `prompt_definition_id` به prompt_definitions اشاره می‌کند.
    //    `is_active` پیش‌فرض false است؛ تنها یک نسخه به‌صورت فعال علامت می‌خورد.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prompt_versions" (
        "id" SERIAL NOT NULL,
        "prompt_definition_id" integer NOT NULL,
        "version" integer NOT NULL,
        "template" text NOT NULL,
        "extra_instructions" text,
        "model" character varying,
        "temperature" double precision,
        "response_format" character varying,
        "created_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "is_active" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_prompt_versions_id" PRIMARY KEY ("id")
      )
    `);

    // FK افزایشی به prompt_definitions با ON DELETE CASCADE (idempotent — وجود
    // constraint بررسی می‌شود؛ Postgres برای ADD CONSTRAINT گزینهٔ IF NOT EXISTS ندارد).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_prompt_versions_prompt_definition_id'
        ) THEN
          ALTER TABLE "prompt_versions"
            ADD CONSTRAINT "FK_prompt_versions_prompt_definition_id"
            FOREIGN KEY ("prompt_definition_id") REFERENCES "prompt_definitions"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // index روی prompt_definition_id برای واکشی سریع نسخه‌های یک prompt.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prompt_versions_prompt_definition_id"
        ON "prompt_versions" ("prompt_definition_id")
    `);

    // ۳) جدول جدید ai_execution_logs — ثبت هر اجرای مدل (طراحی §۱۱.۲).
    //    خروجی خام (raw_input/raw_output) همیشه نگه داشته می‌شود تا اشکال‌زدایی
    //    prompt حتی در حالت خطا ممکن باشد. `entity_id` به‌صورت varchar nullable
    //    نگه داشته می‌شود تا با انواع مختلف شناسهٔ موجودیت سازگار بماند.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_execution_logs" (
        "id" SERIAL NOT NULL,
        "prompt_key" character varying NOT NULL,
        "prompt_version_id" integer,
        "model" character varying,
        "input_summary" text,
        "input_hash" character varying,
        "raw_input" text,
        "raw_output" text,
        "parsed_output" jsonb,
        "status" character varying NOT NULL,
        "error_message" text,
        "duration_ms" integer,
        "token_usage" jsonb,
        "cost_estimate" double precision,
        "entity_type" character varying,
        "entity_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_execution_logs_id" PRIMARY KEY ("id")
      )
    `);

    // indexها روی prompt_key و created_at برای فیلتر/مرتب‌سازی سریع لاگ‌ها (طراحی §۱۲.۳).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_execution_logs_prompt_key"
        ON "ai_execution_logs" ("prompt_key")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_execution_logs_created_at"
        ON "ai_execution_logs" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // بازگشت متقارن — تنها افزوده‌های همین مهاجرت حذف می‌شوند (Requirement 13.4).
    // ترتیب معکوس up: ابتدا index/FK، سپس جدول‌ها به ترتیب معکوس وابستگی.

    // ۳) حذف ai_execution_logs و indexهای آن.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_execution_logs_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_execution_logs_prompt_key"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_execution_logs"`);

    // ۲) حذف index و FK و سپس جدول prompt_versions.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prompt_versions_prompt_definition_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_versions" DROP CONSTRAINT IF EXISTS "FK_prompt_versions_prompt_definition_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt_versions"`);

    // ۱) حذف جدول prompt_definitions (آخرین، چون prompt_versions به آن وابسته بود).
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt_definitions"`);
  }
}
