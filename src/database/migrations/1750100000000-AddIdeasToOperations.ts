import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdeasToOperations1750100000000 implements MigrationInterface {
  name = 'AddIdeasToOperations1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "ideas" jsonb DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "operation_outputs" ADD COLUMN IF NOT EXISTS "idea_id" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "operation_outputs" DROP COLUMN IF EXISTS "idea_id"`);
    await queryRunner.query(`ALTER TABLE "operations" DROP COLUMN IF EXISTS "ideas"`);
  }
}
