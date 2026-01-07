import { Column, Entity, Index } from 'typeorm';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 用户链上充值地址表
 * 用户在不同区块链上的专属充值地址
 */
@Entity({ name: 'user_wallet_address', comment: '用户链上钱包地址' })
@Index('idx_user', ['userId'], { unique: true })
@Index('idx_address', ['address'], { unique: true })
export class UserWalletAddressEntity extends CommonEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({
    comment: '充值地址',
    type: 'varchar',
    length: 64,
  })
  address: string;

  @Column({
    comment: '加密密钥',
    name: 'key',
    type: 'char',
    length: 32,
  })
  key: string;

  @Column({
    comment: '地址状态: 0=正常 1=禁用',
    type: 'tinyint',
    default: 0,
  })
  status: number;
}
