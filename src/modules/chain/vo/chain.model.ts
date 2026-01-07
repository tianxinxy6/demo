import { ApiProperty } from '@nestjs/swagger';

/**
 * 链上代币响应模型 - 用于展示链上支持的代币
 * 包含代币的基本信息和配置
 */
export class ChainTokenResponse {
  @ApiProperty({ description: 'Token ID' })
  id: number;

  @ApiProperty({ description: '代币代码', example: 'USDT' })
  code: string;

  @ApiProperty({ description: '代币名称', example: 'Tether USD' })
  name: string;

  @ApiProperty({
    description: '代币logo',
    example: 'https://example.com/usdt.png',
  })
  logo: string;

  @ApiProperty({
    description: '合约地址（原生代币为null）',
    nullable: true,
    example: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  })
  contract: string | null;

  @ApiProperty({ description: '精度位数', example: 6 })
  decimals: number;

  constructor(partial: Partial<ChainTokenResponse>) {
    Object.assign(this, partial);
    this.contract = partial.contract ?? null;
  }
}
