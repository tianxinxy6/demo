import { Column, Entity, Index } from 'typeorm';
import { CommonDEntity } from '@/common/entities/common.entity';

@Entity({ name: 'order_delegate', comment: '委托订单表' })
@Index('idx_user', ['userId'])
@Index('idx_order', ['orderNo'], { unique: true })
@Index('idx_receiver', ['receiverAddress'])
export class OrderDelegateEntity extends CommonDEntity {
  @Column({ comment: '订单号', name: 'order_no', length: 32 })
  orderNo: string;

  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '接收地址', name: 'receiver_address', length: 50 })
  receiverAddress: string;

  @Column({ comment: '能量数量', name: 'energy_amount', type: 'bigint' })
  energyAmount: number;

  @Column({ comment: 'TRX数量', name: 'trx_amount', type: 'bigint' })
  trxAmount: number;

  @Column({ comment: '租赁时长(s)', name: 'duration', type: 'int' })
  duration: number;

  @Column({ comment: '代币', name: 'token', type: 'varchar', length: 20 })
  token: string;

  @Column({
    comment: '代币ID',
    name: 'token_id',
    type: 'bigint',
  })
  tokenId: number;

  @Column({
    comment: '订单价格(TRX)',
    type: 'bigint',
  })
  price: number;

  @Column({
    comment: '订单状态',
    type: 'tinyint',
    default: 0,
  })
  status: number;

  @Column({
    comment: '交易哈希',
    name: 'hash',
    nullable: true,
    length: 128,
  })
  hash?: string;

  @Column({
    comment: '区块号',
    name: 'block_number',
    type: 'bigint',
    nullable: true,
  })
  blockNumber?: number;

  @Column({
    comment: '到期时间',
    name: 'expire_at',
    type: 'timestamp',
    nullable: true,
  })
  expireAt: Date;

  @Column({
    comment: '失败原因',
    name: 'fail_reason',
    nullable: true,
    type: 'text',
  })
  failReason?: string;

  @Column({
    comment: '完成时间',
    name: 'finished_at',
    type: 'timestamp',
    nullable: true,
  })
  finishedAt?: Date;
}
