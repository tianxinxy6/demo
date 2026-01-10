import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ApiAuthGuard } from '@/common/guards/api-auth.guard';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { MerchantService } from '../services/merchant.service';
import { RentEnergyDto } from '../dto/rent.dto';
import { RentEnergyResponse } from '../vo/energy.vo';
import { WalletService } from '@/modules/user/services/wallet.service';
import { WalletResponse } from '@/modules/user/vo';
import { SkipSignature } from '@/common/decorators/signature.decorator';
import { TronResource } from '@/utils';
import { Idempotence } from '@/common/decorators/idempotence.decorator';

@ApiTags('Merchant - 商户API')
@ApiHeader({
  name: 'X-API-KEY',
  description: '商户API密钥，在商户后台获取',
  required: true,
  example: 'mk_1234567890abcdef',
})
@ApiHeader({
  name: 'X-TIMESTAMP',
  description: '当前时间戳（毫秒），用于防重放攻击，时间误差不超过5分钟',
  required: true,
  example: '1704700800000',
})
@ApiHeader({
  name: 'X-SIGNATURE',
  description: '请求签名，使用API密钥对请求参数进行签名，算法：HMAC-SHA256',
  required: true,
  example: 'a1b2c3d4e5f6...',
})
@UseGuards(ApiAuthGuard)
@SkipSignature()
@Controller({ path: 'merchant', version: '1' })
export class MerchantController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly walletService: WalletService,
  ) {}

  @Post('energy/rent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '租赁TRON能量',
    description: `
为指定地址租赁TRON能量，用于支付智能合约交易的gas费用。

**业务说明：**
- 能量可用于降低USDT等TRC20代币的转账手续费
- 最小租赁数量：32000能量
- 支持时长：10分钟、1小时（60分钟）、1天（1440分钟）
- 租赁成功后，能量会立即委托到接收地址
- 费用从商户钱包余额中扣除

**价格计算：**
- 价格根据市场行情实时计算
- 租赁时间越长，单价越优惠

**注意事项：**
- 接收地址必须是有效的TRON地址
- 确保商户钱包余额充足
- 能量租赁后不可提前退租
    `,
  })
  @ApiBody({ type: RentEnergyDto })
  @ApiResponse({
    status: 200,
    description: '租赁成功',
    type: RentEnergyResponse,
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误',
    schema: {
      example: {
        code: 10001,
        message: '能量数量不能小于32000',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '认证失败',
    schema: {
      example: {
        code: 10002,
        message: '签名验证失败',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '服务器内部错误',
    schema: {
      example: {
        code: 21102,
        message: '余额不足',
      },
    },
  })
  @Idempotence()
  async rentEnergy(
    @AuthUser() user: IAuthUser,
    @Body() dto: RentEnergyDto,
  ): Promise<RentEnergyResponse> {
    return this.merchantService.rentEnergy(user.uid, dto);
  }

  @Get('wallet')
  @ApiOperation({
    summary: '查询商户钱包余额',
    description: `
查询商户账户的钱包余额信息，包括所有支持的代币。

**返回信息包含：**
- 各代币的可用余额
- 冻结余额（处理中的订单占用）
- 总余额

**支持的代币：**
- TRX：波场原生代币
- USDT：TRC20-USDT稳定币
    `,
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [WalletResponse],
    schema: {
      example: [
        {
          token: {
            code: 'TRX',
            name: 'TRON',
            logo: 'https://example.com/trx.png',
          },
          balance: '1000.5',
          frozenBalance: '100.0',
          totalBalance: '1100.5',
        },
        {
          token: {
            code: 'USDT',
            name: 'Tether USD',
            logo: 'https://example.com/usdt.png',
          },
          balance: '5000.123456',
          frozenBalance: '0',
          totalBalance: '5000.123456',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: '认证失败',
  })
  async getMyWallets(@AuthUser() user: IAuthUser): Promise<WalletResponse[]> {
    return this.walletService.getUserWalletsWithToken(user.uid);
  }

  @Get('platform/energy')
  @ApiOperation({
    summary: '查询平台可租赁能量余额',
    description: `
查询平台当前剩余的可租赁能量数量。

**业务说明：**
- 返回平台实时可用的能量总量
- 建议在租赁前先查询，确保平台能量充足
- 能量余额会根据租赁情况实时变化

**使用场景：**
- 租赁前检查平台是否有足够的能量
- 展示平台服务可用性
    `,
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: 10000000,
      type: 'number',
      description: '可租赁能量数量（单位：能量）',
    },
  })
  @ApiResponse({
    status: 401,
    description: '认证失败',
  })
  async queryPlatformEnergy(): Promise<TronResource> {
    return await this.merchantService.energyBalance();
  }
}
