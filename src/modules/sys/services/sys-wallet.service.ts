import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Status, SysWalletType, ErrorCode } from '@/constants';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { AddressMgrService } from '@/shared/services/wallet.service';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { generateRandomString, TronUtil } from '@/utils';

/**
 * 系统钱包地址服务
 *
 * 主要功能：
 * 1. 管理系统级别的钱包地址（手续费钱包、提现钱包）
 * 3. 归集地址配置管理
 */
@Injectable()
export class SysWalletAddressService {
  private readonly logger = new Logger(SysWalletAddressService.name);

  constructor(
    @InjectRepository(SysWalletAddressEntity)
    private readonly walletAddressRepository: Repository<SysWalletAddressEntity>,
    private readonly addressMgrService: AddressMgrService,
  ) {}

  /**
   * 创建新的系统钱包
   * @param chainType 链类型
   * @param type 钱包类型（手续费/提现）
   */
  async create(type: SysWalletType): Promise<void> {
    const address = await this.walletAddressRepository.findOne({
      where: { type },
    });
    if (address) {
      return;
    }

    try {
      // 使用钱包服务生成地址
      const addressInfo = await TronUtil.generate();

      // 随机生成 32 位 key
      const key = generateRandomString();

      // 保存到数据库
      const walletAddress = new SysWalletAddressEntity();
      walletAddress.type = type;
      walletAddress.name = 'wallet';
      walletAddress.address = addressInfo.address;
      walletAddress.key = key;
      walletAddress.status = Status.Enabled;

      const savedAddress = await this.walletAddressRepository.save(walletAddress);

      // 存储私钥到 Vault（系统地址不需要 userId）
      await this.addressMgrService.storePrivateKey(savedAddress.id, null, {
        ...addressInfo,
        secKey: key,
      });
    } catch (error) {
      this.logger.error(`Failed to create chain address: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeeWallet(): Promise<string> {
    return await this.getWallet(SysWalletType.Fee);
  }

  async getWithdrawWallet(): Promise<string> {
    return await this.getWallet(SysWalletType.Widthdraw);
  }

  async getEnergyWallet(): Promise<string> {
    return await this.getWallet(SysWalletType.Energy);
  }

  /**
   * 获取系统钱包地址的私钥
   * @param type 钱包类型
   */
  async getWallet(type: SysWalletType): Promise<string> {
    const address = await this.walletAddressRepository.findOne({
      where: {
        type,
        status: Status.Enabled,
      },
    });
    if (!address) {
      this.logger.warn(`System wallet not found: type=${type}`);
      throw new BusinessException(ErrorCode.ErrSysWalletNotFound);
    }
    return await this.addressMgrService.getPrivateKey(address.id, null, address.key);
  }
}
