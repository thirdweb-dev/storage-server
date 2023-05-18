import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCreatorAddressNullable1684438780160
  implements MigrationInterface
{
  name = 'MakeCreatorAddressNullable1684438780160';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" ALTER COLUMN "apiKeyCreatorWalletAddress" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload" ALTER COLUMN "apiKeyCreatorWalletAddress" SET NOT NULL`
    );
  }
}
