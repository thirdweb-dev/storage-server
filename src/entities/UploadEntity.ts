import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CREATOR_WALLET_ADDRESS_WHILE_ORIGINAL_CREATOR_IS_UNKNOWN } from '../constants/apiKeys';

@Entity('upload')
export class UploadEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({
    default: CREATOR_WALLET_ADDRESS_WHILE_ORIGINAL_CREATOR_IS_UNKNOWN,
  })
  apiKeyCreatorWalletAddress!: string;

  @Column()
  cid!: string;
}
