import { Column, Entity } from 'typeorm';
import { Exclude } from 'class-transformer';
import { CommonDEntity } from '@/common/entities/common.entity';

@Entity({ name: 'user', comment: '用户表' })
export class UserEntity extends CommonDEntity {
  @Column({ comment: '用户名' })
  username: string;

  @Column({ comment: '密码哈希值' })
  @Exclude()
  password: string;

  @Column({ comment: '交易密码哈希值', name: 'trans_password', nullable: true })
  @Exclude()
  transPassword?: string;

  @Column({ comment: '昵称', default: '' })
  nickname: string;

  @Column({ comment: '头像', default: '' })
  avatar: string;

  @Column({ comment: '当前登录ip', name: 'login_ip', default: '' })
  loginIp?: string;

  @Column({
    comment: '当前登录时间',
    name: 'login_time',
    type: 'timestamp',
    nullable: true,
  })
  loginTime?: Date;

  @Column({ comment: 'Telegram ID', name: 'tg_id', nullable: true })
  tgId?: number;

  @Column({ comment: '用户状态（0:禁用 1:正常）', default: 1, type: 'tinyint' })
  status?: number;
}
