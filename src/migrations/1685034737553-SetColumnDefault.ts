import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetColumnDefault1685034737553 implements MigrationInterface {
  name = 'SetColumnDefault1685034737553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" ALTER COLUMN "apiKeyCreatorWalletAddress" SET DEFAULT '0x2'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" ALTER COLUMN "apiKeyCreatorWalletAddress" DROP DEFAULT`
    );
  }
}
