import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — جدول‌های `hubs` و `hub_users`
 * (design §3.1). کاملاً افزایشی و غیرتخریبی؛ هیچ جدول/ستون موجودی تغییر نمی‌کند.
 *
 * `hubs.manager_user_id` → `users.id` با ON DELETE SET NULL.
 * `hub_users` رابطهٔ کاربر↔هاب با UNIQUE(hub_id, user_id) و FKهای CASCADE.
 */
export class CreateHubsAndHubUsers1740000000000 implements MigrationInterface {
  name = 'CreateHubsAndHubUsers1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hubs" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "manager_user_id" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hubs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hubs_manager_user_id'
        ) THEN
          ALTER TABLE "hubs"
            ADD CONSTRAINT "FK_hubs_manager_user_id"
            FOREIGN KEY ("manager_user_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hub_users" (
        "id" SERIAL NOT NULL,
        "hub_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "role_in_hub" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hub_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hub_users_hub_user"
        ON "hub_users" ("hub_id", "user_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hub_users_hub_id'
        ) THEN
          ALTER TABLE "hub_users"
            ADD CONSTRAINT "FK_hub_users_hub_id"
            FOREIGN KEY ("hub_id") REFERENCES "hubs"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hub_users_user_id'
        ) THEN
          ALTER TABLE "hub_users"
            ADD CONSTRAINT "FK_hub_users_user_id"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hub_users" DROP CONSTRAINT IF EXISTS "FK_hub_users_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hub_users" DROP CONSTRAINT IF EXISTS "FK_hub_users_hub_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_hub_users_hub_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hub_users"`);
    await queryRunner.query(
      `ALTER TABLE "hubs" DROP CONSTRAINT IF EXISTS "FK_hubs_manager_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "hubs"`);
  }
}
