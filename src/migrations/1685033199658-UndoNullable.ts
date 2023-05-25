import { MigrationInterface, QueryRunner } from 'typeorm';

export class UndoNullable1685033199658 implements MigrationInterface {
  name = 'UndoNullable1685033199658';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" ALTER COLUMN "apiKeyCreatorWalletAddress" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" ALTER COLUMN "apiKeyCreatorWalletAddress" DROP NOT NULL`
    );
  }
}
