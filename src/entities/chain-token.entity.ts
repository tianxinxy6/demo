import { Column, Entity, Index } from 'typeorm';
import { CommonEntity } from '@/common/entities/common.entity';
import { Status } from '@/constants';

type FeeConfig = {
  rate: number; // 手续费率，万分比表示
  min: number; // 最小手续费
  max: number; // 最大手续费
};

/**
 * 代币配置表
 * 管理每条链上支持的代币列表
 */
@Entity({ name: 'chain_token', comment: '代币配置' })
@Index('idx_code', ['code'], { unique: true })
export class ChainTokenEntity extends CommonEntity {
  /**
   * 代币代码 - 链内唯一
   * 原生代币：TRX, ETH
   * ERC20: USDT, USDC 等
   */
  @Column({ comment: '代币代码', length: 50 })
  code: string;

  @Column({ comment: '代币名称', length: 100 })
  name: string;

  @Column({ comment: '代币logo', length: 100, default: '' })
  logo: string;

  @Column({
    comment: '状态',
    type: 'tinyint',
    default: Status.Enabled,
  })
  status: Status;

  /**
   * 合约地址（原生代币为空）
   * ERC20/TRC20: 0x... 或 T...
   */
  @Column({
    comment: '合约地址',
    name: 'contract',
    length: 255,
    nullable: true,
  })
  contract?: string;

  /**
   * 代币精度（小数位数）
   * TRX: 6 (1 TRX = 1_000_000 SUN)
   * ETH: 18 (1 ETH = 10^18 WEI)
   * USDT: 6
   * USDC: 6
   */
  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  // 手续费 json 字符串，定义 type
  @Column({
    comment: '提现手续费配置',
    name: 'withdraw_fee',
    type: 'json',
    nullable: true,
  })
  withdrawFee?: FeeConfig;
}
