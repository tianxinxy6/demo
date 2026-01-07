import { CommonEntity } from '@/common/entities/common.entity';
import { WalletStatus } from '@/constants';
import { Column, Entity, Index } from 'typeorm';

/**
 * 用户中心化钱包表
 */
@Entity({ name: 'user_wallet', comment: '用户中心化钱包' })
@Index('idx_user_token', ['userId', 'tokenId'], { unique: true })
export class UserWalletEntity extends CommonEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '代币ID(关联token表)', name: 'token_id', type: 'int' })
  tokenId: number;

  @Column({
    comment: '可用余额',
    type: 'bigint',
    default: 0,
  })
  balance: number;

  @Column({
    comment: '冻结余额(提现中等)',
    name: 'frozen_balance',
    type: 'bigint',
    default: 0,
  })
  frozenBalance: number;

  @Column({
    comment: '钱包状态: 0=正常 1=冻结 2=禁用',
    type: 'tinyint',
    default: WalletStatus.ACTIVE,
  })
  status: number;
}
