import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { ChainTokenService } from '../services/token.service';
import { ChainTokenResponse } from '../vo';

@ApiTags('Chain - 区块链管理')
@ApiSecurityAuth()
@Controller({ path: 'chain', version: '1' })
export class ChainController {
  constructor(private readonly tokenService: ChainTokenService) {}

  /**
   * 获取链上的所有代币列表
   */
  @Get('token')
  @ApiOperation({ summary: '获取链上代币列表' })
  @ApiResponse({
    status: 200,
    type: [ChainTokenResponse],
    description: '链上代币列表',
  })
  async getChainTokens(): Promise<ChainTokenResponse[]> {
    return this.tokenService.getChainTokenData();
  }
}
