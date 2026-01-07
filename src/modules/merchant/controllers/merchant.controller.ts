import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { ApiAuthGuard } from '@/common/guards/api-auth.guard';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { MerchantService } from '../services/merchant.service';
import { RentEnergyDto, ReclaimEnergyDto } from '../dto/rent.dto';
import { RentEnergyResponse } from '../vo/energy.vo';
import { WalletService } from '@/modules/user/services/wallet.service';
import { WalletResponse } from '@/modules/user/vo';
import { SkipSignature } from '@/common/decorators/signature.decorator';

@ApiTags('Merchant - 商户服务')
@ApiHeader({ name: 'X-API-KEY', description: 'API密钥', required: true })
@ApiHeader({ name: 'X-TIMESTAMP', description: '时间戳', required: true })
@ApiHeader({ name: 'X-SIGNATURE', description: '签名', required: true })
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
  @ApiOperation({ summary: '租赁能量' })
  async rentEnergy(
    @AuthUser() user: IAuthUser,
    @Body() dto: RentEnergyDto,
  ): Promise<RentEnergyResponse> {
    return this.merchantService.rentEnergy(user.uid, dto);
  }

  @Post('energy/reclaim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '回收能量' })
  async reclaimEnergy(@AuthUser() user: IAuthUser, @Body() dto: ReclaimEnergyDto): Promise<void> {
    return this.merchantService.reclaimEnergy(user.uid, dto);
  }

  /**
   * 获取我的钱包列表
   */
  @Get('wallet')
  @ApiOperation({ summary: '获取我的钱包列表' })
  @ApiResponse({ status: 200, type: [WalletResponse], description: '钱包列表' })
  async getMyWallets(@AuthUser() user: IAuthUser): Promise<WalletResponse[]> {
    return this.walletService.getUserWalletsWithToken(user.uid);
  }

  @Get('platform/energy')
  @ApiOperation({ summary: '查询平台剩余可租赁能量' })
  async queryPlatformEnergy(): Promise<number> {
    return this.merchantService.energyBalance();
  }
}
