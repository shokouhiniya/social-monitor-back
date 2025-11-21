import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmailPasswordToUsers1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add email column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'email',
        type: 'varchar',
        isUnique: true,
        isNullable: false,
      }),
    );

    // Add password column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'password',
        type: 'varchar',
        isNullable: false,
      }),
    );

    // Make phone nullable
    await queryRunner.changeColumn(
      'users',
      'phone',
      new TableColumn({
        name: 'phone',
        type: 'varchar',
        isUnique: true,
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'email');
    await queryRunner.dropColumn('users', 'password');

    await queryRunner.changeColumn(
      'users',
      'phone',
      new TableColumn({
        name: 'phone',
        type: 'varchar',
        isUnique: true,
        isNullable: false,
      }),
    );
  }
}
