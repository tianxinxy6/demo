import { Column, Entity } from 'typeorm';
import { Exclude } from 'class-transformer';
import { CommonDEntity } from '@/common/entities/common.entity';
import { Status } from '@/constants';

/**
 * 商户实体
 */
@Entity({ name: 'merchant', comment: 'api秘钥表' })
export class MerchantEntity extends CommonDEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '商户名称', name: 'name', length: 200 })
  name: string;

  @Column({ comment: 'API Key', name: 'key', unique: true, length: 64 })
  key: string;

  @Column({ comment: 'API Secret', name: 'secret', length: 128 })
  @Exclude()
  secret: string;

  @Column({
    comment: 'IP白名单',
    name: 'ip_whitelist',
    type: 'json',
    nullable: true,
  })
  ipWhitelist?: string[];

  @Column({
    comment: '状态',
    default: Status.Enabled,
    type: 'tinyint',
  })
  status: Status;
}
