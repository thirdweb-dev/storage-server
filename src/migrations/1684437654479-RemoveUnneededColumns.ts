import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUnneededColumns1684437654479 implements MigrationInterface {
  name = 'RemoveUnneededColumns1684437654479';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "upload" DROP COLUMN "apiKey"`);
    await queryRunner.query(`ALTER TABLE "upload" DROP COLUMN "isDirectory"`);
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "apiKeyCreatorWalletAddress" character varying NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" DROP COLUMN "apiKeyCreatorWalletAddress"`
    );
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "isDirectory" boolean NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "apiKey" character varying NOT NULL`
    );
  }
}
