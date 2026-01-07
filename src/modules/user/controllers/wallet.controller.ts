import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ChainAddressService } from '../services/chain-address.service';
import { WalletService } from '../services/wallet.service';
import { ChainAddressResponse, WalletResponse } from '../vo';

@ApiTags('Wallet - 钱包管理')
@ApiSecurityAuth()
@Controller({ path: 'wallet', version: '1' })
export class WalletController {
  constructor(
    private readonly chainAddressService: ChainAddressService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * 获取我的钱包列表
   */
  @Get()
  @ApiOperation({ summary: '获取我的钱包列表' })
  @ApiResponse({ status: 200, type: [WalletResponse], description: '钱包列表' })
  async getMyWallets(@AuthUser() user: IAuthUser): Promise<WalletResponse[]> {
    return this.walletService.getUserWalletsWithToken(user.uid);
  }

  /**
   * 获取用户所有区块链地址
   */
  @Get('addresses')
  @ApiOperation({ summary: '获取所有区块链地址' })
  @ApiResponse({ status: 200, type: [ChainAddressResponse] })
  async getAddresses(@AuthUser() user: IAuthUser): Promise<ChainAddressResponse> {
    return this.chainAddressService.createAndGet(user.uid);
  }
}
