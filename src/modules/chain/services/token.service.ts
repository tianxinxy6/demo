import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { CacheConfigs, Status } from '@/constants';
import { CacheService } from '@/shared/cache/cache.service';

/**
 * 代币服务 - 钱包系统核心功能
 * 提供钱包业务必需的代币查询和缓存功能
 */
@Injectable()
export class ChainTokenService {
  private readonly logger = new Logger(ChainTokenService.name);
  private readonly cacheConfig = CacheConfigs.CHAIN_TOKEN;

  constructor(
    @InjectRepository(ChainTokenEntity)
    private readonly tokenRepository: Repository<ChainTokenEntity>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 获取链上所有代币
   */
  async getChainTokenData(): Promise<Array<IChainToken>> {
    const cacheKey = `${this.cacheConfig.prefix}data`;

    const cached = await this.cacheService.get<Array<IChainToken>>(cacheKey);
    if (cached) {
      return cached;
    }

    const tokens = await this.tokenRepository.find({
      where: {
        status: Status.Enabled,
      },
    });

    const tokenData = tokens.map((token) => ({
      id: token.id,
      name: token.name,
      code: token.code,
      logo: token.logo,
      contract: token.contract,
      decimals: token.decimals,
    }));

    await this.cacheService.set(cacheKey, tokenData, { ttl: this.cacheConfig.ttl });
    return tokenData;
  }

  /**
   * 根据代币代码获取合约地址
   */
  async getAddressByCode(code: string): Promise<IChainToken | null> {
    if (!code?.trim()) return null;

    const tokenData = await this.getChainTokenData();
    const token = tokenData.find((t) => t.code === code.trim());
    return token || null;
  }

  async getTokenById(id: number): Promise<IChainToken | null> {
    const tokenData = await this.getChainTokenData();
    const token = tokenData.find((t) => t.id === id);
    return token || null;
  }

  async getDetailById(id: number): Promise<ChainTokenEntity> {
    return await this.tokenRepository.findOne({
      where: {
        id,
        status: Status.Enabled,
      },
    });
  }

  /**
   * 根据合约地址获取代币代码
   */
  async getCodeByAddress(contract: string): Promise<IChainToken | null> {
    if (!contract?.trim()) return null;

    const normalizedAddress = contract.trim();
    const tokenData = await this.getChainTokenData();
    const token = tokenData.find((t) => t.contract === normalizedAddress);
    return token || null;
  }

  /**
   * 获取链上需要监听的代币合约地址数组（用于区块交易过滤）
   */
  async getChainTokens(): Promise<string[]> {
    const tokenData = await this.getChainTokenData();
    // 过滤空合约地址
    const filteredTokenData = tokenData.filter((t) => t.contract);
    return filteredTokenData.map((t) => t.contract);
  }
}
