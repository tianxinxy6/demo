import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { MerchantEntity } from '@/entities/merchant.entity';
import { UserEntity } from '@/entities/user.entity';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode, Status } from '@/constants';
import { CreateMerchantDto } from '../dto/create-merchant.dto';
import { ChainAddressService } from '@/modules/user/services/chain-address.service';

/**
 * Admin 服务 - 内部应用调用
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(MerchantEntity)
    private readonly merchantRepo: Repository<MerchantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly addressService: ChainAddressService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建商户
   * @param dto 商户信息
   * @returns 商户 Key 和 Secret
   */
  async createMerchant(dto: CreateMerchantDto): Promise<{ apiKey: string; apiSecret: string }> {
    // 1. 检查商户名称是否已存在
    const existingMerchant = await this.merchantRepo.findOne({
      where: { name: dto.name },
    });
    if (existingMerchant) {
      throw new BusinessException(ErrorCode.ErrAdminMerchantNameExists);
    }

    // 2. 生成 API Key 和 Secret
    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();

    // 3. 在事务中创建用户和商户
    return await this.dataSource.transaction(async (manager) => {
      // 创建用户
      const user = manager.create(UserEntity, {
        username: `merchant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        password: crypto.randomBytes(32).toString('hex'), // 随机密码
        nickname: dto.name,
        status: Status.Disable,
      });
      const savedUser = await manager.save(UserEntity, user);

      // 创建商户记录
      const merchant = manager.create(MerchantEntity, {
        userId: savedUser.id,
        name: dto.name,
        key: apiKey,
        secret: apiSecret,
        status: Status.Enabled,
      });
      await manager.save(MerchantEntity, merchant);

      // 为商户创建钱包
      await this.addressService.createAndGet(savedUser.id);

      return { apiKey, apiSecret };
    });
  }

  /**
   * 生成 API Key（32位随机字符串）
   */
  private generateApiKey(): string {
    return `mk_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * 生成 API Secret（64位随机字符串）
   */
  private generateApiSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 验证 API Key（用于 API Key Guard）
   */
  async validateApiKey(apiKey: string): Promise<MerchantEntity | null> {
    const merchant = await this.merchantRepo.findOne({
      where: { key: apiKey, status: Status.Enabled },
    });

    return merchant || null;
  }
}
