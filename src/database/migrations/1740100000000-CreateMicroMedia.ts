import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — جدول‌های `micro_media` و
 * `micro_media_tags` (design §3.2). افزایشی و غیرتخریبی.
 *
 * `hub_id` → `hubs.id` (SET NULL)، `topic_cluster_id` → `clusters.id` (SET NULL).
 * `micro_media_tags.micro_media_id` → `micro_media.id` (CASCADE).
 */
export class CreateMicroMedia1740100000000 implements MigrationInterface {
  name = 'CreateMicroMedia1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "micro_media" (
        "id" SERIAL NOT NULL,
        "hub_id" integer,
        "name" character varying NOT NULL,
        "identity_title" character varying,
        "identity_description" text,
        "activity_domain" character varying,
        "contact_name" character varying,
        "contact_phone" character varying,
        "contact_email" character varying,
        "contact_notes" text,
        "country" character varying,
        "nationality" character varying,
        "language" character varying,
        "religion" character varying,
        "gender" character varying,
        "age_group" character varying,
        "topic_cluster_id" integer,
        "status" character varying NOT NULL DEFAULT 'active',
        "importance_level" character varying,
        "notes" text,
        "created_by_user_id" integer,
        "updated_by_user_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_micro_media_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_micro_media_hub_id"
        ON "micro_media" ("hub_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_micro_media_hub_id'
        ) THEN
          ALTER TABLE "micro_media"
            ADD CONSTRAINT "FK_micro_media_hub_id"
            FOREIGN KEY ("hub_id") REFERENCES "hubs"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_micro_media_topic_cluster_id'
        ) THEN
          ALTER TABLE "micro_media"
            ADD CONSTRAINT "FK_micro_media_topic_cluster_id"
            FOREIGN KEY ("topic_cluster_id") REFERENCES "clusters"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "micro_media_tags" (
        "id" SERIAL NOT NULL,
        "micro_media_id" integer NOT NULL,
        "tag" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_micro_media_tags_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_micro_media_tags_media"
        ON "micro_media_tags" ("micro_media_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_micro_media_tags_tag"
        ON "micro_media_tags" ("tag")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_micro_media_tags_media_id'
        ) THEN
          ALTER TABLE "micro_media_tags"
            ADD CONSTRAINT "FK_micro_media_tags_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "micro_media_tags" DROP CONSTRAINT IF EXISTS "FK_micro_media_tags_media_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_micro_media_tags_tag"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_micro_media_tags_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "micro_media_tags"`);
    await queryRunner.query(
      `ALTER TABLE "micro_media" DROP CONSTRAINT IF EXISTS "FK_micro_media_topic_cluster_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "micro_media" DROP CONSTRAINT IF EXISTS "FK_micro_media_hub_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_micro_media_hub_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "micro_media"`);
  }
}
