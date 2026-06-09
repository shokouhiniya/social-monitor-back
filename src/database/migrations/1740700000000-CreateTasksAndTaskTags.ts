import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * مهاجرت micromedia-transformation فاز ۱ — جدول‌های `tasks` و `task_tags`
 * (design §3.7، تصمیم ۳). جدا از `action_plans` legacy. افزایشی.
 *
 * ارجاع‌های context (`hub_id`, `micro_media_id`, `cluster_id`, `operation_id`)
 * ستون integer ساده‌اند با FK نرم (SET NULL). `task_tags.task_id` با CASCADE.
 * اعتبارسنجی «حداقل یک context» در سرویس انجام می‌شود (نه در schema).
 */
export class CreateTasksAndTaskTags1740700000000
  implements MigrationInterface
{
  name = 'CreateTasksAndTaskTags1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'open',
        "priority" character varying NOT NULL DEFAULT 'normal',
        "assignee_user_id" integer,
        "created_by_user_id" integer,
        "hub_id" integer,
        "micro_media_id" integer,
        "cluster_id" integer,
        "operation_id" integer,
        "due_date" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_status" ON "tasks" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_assignee" ON "tasks" ("assignee_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_hub" ON "tasks" ("hub_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_micro_media" ON "tasks" ("micro_media_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_operation" ON "tasks" ("operation_id")`,
    );

    // FKهای نرم (SET NULL) — حذف موجودیت مرتبط، تسک را تخریب نمی‌کند.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tasks_hub_id') THEN
          ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_hub_id"
            FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tasks_micro_media_id') THEN
          ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_micro_media_id"
            FOREIGN KEY ("micro_media_id") REFERENCES "micro_media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tasks_cluster_id') THEN
          ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_cluster_id"
            FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_tags" (
        "id" SERIAL NOT NULL,
        "task_id" integer NOT NULL,
        "tag" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_tags_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_tags_task" ON "task_tags" ("task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_tags_tag" ON "task_tags" ("tag")`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_task_tags_task_id') THEN
          ALTER TABLE "task_tags" ADD CONSTRAINT "FK_task_tags_task_id"
            FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_tags" DROP CONSTRAINT IF EXISTS "FK_task_tags_task_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_task_tags_tag"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_task_tags_task"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_tags"`);

    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_cluster_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_micro_media_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_hub_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_operation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_micro_media"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_hub"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_assignee"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
  }
}
