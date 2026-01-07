import { ApiProperty } from '@nestjs/swagger';
import { TronUtil } from '@/utils';

/**
 * 钱包中的代币信息
 */
export class WalletTokenInfo {
  @ApiProperty({ description: '代币代码', example: 'USDT' })
  code: string;

  @ApiProperty({ description: '代币名称', example: 'Tether USD' })
  name: string;

  @ApiProperty({ description: '代币logo', example: 'https://example.com/usdt.png' })
  logo: string;

  constructor(partial: Partial<WalletTokenInfo>) {
    Object.assign(this, partial);
  }
}

/**
 * 用户钱包响应模型
 */
export class WalletResponse {
  @ApiProperty({ description: '代币信息', type: WalletTokenInfo })
  token: WalletTokenInfo;

  @ApiProperty({ description: '可用余额', example: '100.5' })
  balance: string;

  @ApiProperty({ description: '冻结余额', example: '0' })
  frozenBalance: string;

  @ApiProperty({ description: '总余额', example: '100.5' })
  totalBalance: string;

  constructor(partial: {
    token: WalletTokenInfo;
    balance: number | string;
    frozenBalance: number | string;
  }) {
    this.token = partial.token;

    // 处理 number 或 string 类型
    const balanceStr =
      typeof partial.balance === 'number' ? partial.balance.toString() : partial.balance;
    const frozenBalanceStr =
      typeof partial.frozenBalance === 'number'
        ? partial.frozenBalance.toString()
        : partial.frozenBalance;

    // 格式化金额
    this.balance = TronUtil.fromSun(balanceStr);
    this.frozenBalance = TronUtil.fromSun(frozenBalanceStr);

    // 计算总余额
    const balanceBigInt = BigInt(balanceStr);
    const frozenBigInt = BigInt(frozenBalanceStr);
    const total = balanceBigInt + frozenBigInt;
    this.totalBalance = TronUtil.fromSun(total.toString());
  }
}
