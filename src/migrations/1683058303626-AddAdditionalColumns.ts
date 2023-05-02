import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdditionalColumns1683058303626 implements MigrationInterface {
  name = 'AddAdditionalColumns1683058303626';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "upload" DROP COLUMN "uploaderId"`);
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "apiKey" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "isDirectory" boolean NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "cid" character varying NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "upload" DROP COLUMN "cid"`);
    await queryRunner.query(`ALTER TABLE "upload" DROP COLUMN "isDirectory"`);
    await queryRunner.query(`ALTER TABLE "upload" DROP COLUMN "apiKey"`);
    await queryRunner.query(
      `ALTER TABLE "upload" ADD "uploaderId" character varying NOT NULL`
    );
  }
}
