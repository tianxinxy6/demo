import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TronUtil } from '@/utils/tron.util';
import { generateOrderNo } from '@/utils';
import { DelegateStatus, ErrorCode, WalletLogType } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { WalletService } from '@/modules/user/services/wallet.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { DelegateService } from '@/modules/order/services/delegate.service';
import { RentEnergyDto, ReclaimEnergyDto } from '../dto/rent.dto';
import { RentEnergyResponse } from '../vo/energy.vo';
import { ChainTokenService } from '@/modules/chain/services/token.service';
import { trxPrice } from '@/constants/price.constant';
import { AppConfigService } from '@/shared/services/config.service';

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);
  private readonly tronUtil: TronUtil;

  constructor(
    private readonly walletService: WalletService,
    private readonly sysWalletService: SysWalletAddressService,
    private readonly delegateService: DelegateService,
    private readonly chainTokenService: ChainTokenService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
  ) {
    const rpcUrl = this.configService.get<string>('tron.rpcUrl');
    this.tronUtil = new TronUtil(rpcUrl);
  }

  /**
   * 租赁能量
   */
  async rentEnergy(userId: number, dto: RentEnergyDto): Promise<RentEnergyResponse> {
    // 1. 验证接收地址格式
    if (!TronUtil.validateAddress(dto.receiverAddress)) {
      throw new BusinessException(ErrorCode.ErrAddressInvalid);
    }

    // 2. 检查地址是否激活（有TRX余额或有交易记录）
    const isActivated = await this.tronUtil.checkAddressActivated(dto.receiverAddress);
    if (!isActivated) {
      throw new BusinessException(ErrorCode.ErrAddressNotActivated);
    }

    const ownerAddress = await this.appConfigService.getEnergyOwnerWallet();
    if (!ownerAddress) {
      this.logger.warn('能量所有者地址未配置');
      throw new BusinessException(ErrorCode.ErrAddressInvalid);
    }

    // 3. 计算租赁价格和时长
    const priceInSun = this.calcRentPrice(dto.energyAmount, dto.minutes);
    const durationSeconds = dto.minutes * 60; // 分钟转秒

    // 7. 获取系统能量钱包私钥
    const sysPrivateKey = await this.sysWalletService.getEnergyWallet();
    this.tronUtil.setPrivateKey(sysPrivateKey);

    // 4. 检查平台可用能量是否足够
    const platformEnergy = await this.tronUtil.getAccountEnergy();
    if (platformEnergy < dto.energyAmount) {
      throw new BusinessException(ErrorCode.ErrDelegateEnergyInsufficient);
    }

    const trxAmount = await this.tronUtil.convertEnergyToTrx(dto.energyAmount);
    if (trxAmount == 0) {
      throw new BusinessException(ErrorCode.ErrDelegateEnergyInsufficient);
    }

    const token = await this.chainTokenService.getAddressByCode('TRX');

    // 5. 使用事务确保原子性
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.delegateService.create(queryRunner, token, {
        orderNo: generateOrderNo(),
        userId,
        receiverAddress: dto.receiverAddress,
        trxAmount,
        energyAmount: dto.energyAmount,
        duration: durationSeconds,
        price: priceInSun,
      });

      await this.walletService.subBalance(queryRunner, {
        userId,
        tokenId: token.id,
        amount: priceInSun,
        type: WalletLogType.ENERGY_RENT,
        orderId: order.id,
        remark: `租赁能量: ${dto.energyAmount} 到 ${dto.receiverAddress}`,
      });

      // 9. 执行链上能量委托
      const result = await this.tronUtil.delegateResourceWithPermission(
        ownerAddress,
        dto.receiverAddress,
        trxAmount,
      );
      if (!result.result) {
        this.logger.error(
          `链上委托失败: 订单${order.orderNo}, 用户${userId}, 原因: ${result.code}`,
        );
        throw new BusinessException(ErrorCode.ErrTransactionExecuteFailed);
      }

      // 10. 更新订单为成功状态
      await this.delegateService.updateSuccess(queryRunner, order, result.txid, durationSeconds);

      // 11. 提交事务
      await queryRunner.commitTransaction();

      return this.toRentResponse(order);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`能量租赁失败: 用户${userId}, 原因: ${error.message}`);
      throw new BusinessException(ErrorCode.ErrTransactionExecuteFailed);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 回收能量
   */
  async reclaimEnergy(userId: number, dto: ReclaimEnergyDto): Promise<void> {
    // 使用DelegateService查询订单
    const order = await this.delegateService.findByOrderNo(dto.orderNo, userId);
    if (!order) {
      throw new BusinessException(ErrorCode.ErrDataNotFound);
    }
    if (order.status !== DelegateStatus.Success) {
      throw new BusinessException(ErrorCode.ErrDelegateStatusInvalid);
    }

    // 获取系统钱包私钥
    const sysPrivateKey = await this.sysWalletService.getFeeWallet();
    this.tronUtil.setPrivateKey(sysPrivateKey);

    // 取消委托
    const result = await this.tronUtil.undelegateResource(
      order.receiverAddress,
      order.energyAmount,
    );
    if (!result.result) {
      this.logger.error(`链上回收失败: 订单${order.orderNo}, 用户${userId}, 原因: ${result.code}`);
      throw new BusinessException(ErrorCode.ErrTransactionExecuteFailed);
    }

    // 使用事务确保原子性
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 能量回收需要增加钱包余额
      await this.walletService.addBalance(queryRunner, {
        userId,
        tokenId: order.tokenId,
        amount: order.price,
        type: WalletLogType.ENERGY_RECLAIM,
        orderId: order.id,
        remark: `回收能量: 订单${order.orderNo}`,
      });

      // 使用DelegateService更新订单状态
      await this.delegateService.updateReclaimed(queryRunner, order);

      // 提交事务
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`能量回收失败: 订单${order.orderNo}, 原因: ${error.message}`);
      throw new BusinessException(ErrorCode.ErrTransactionExecuteFailed);
    } finally {
      await queryRunner.release();
    }
  }

  async energyBalance(): Promise<number> {
    // 获取系统钱包私钥
    const sysPrivateKey = await this.sysWalletService.getFeeWallet();
    this.tronUtil.setPrivateKey(sysPrivateKey);

    return this.tronUtil.getAccountEnergy();
  }

  /**
   * 计算租赁价格 (TRX)
   * 使用向上取值策略：如果请求的分钟数在两个档位之间，使用较高档位的价格
   * 例如：30分钟会使用60分钟的价格
   */
  private calcRentPrice(energyAmount: number, minutes: number): number {
    // 按分钟数升序排序价格配置
    const sortedPrices = [...trxPrice].sort((a, b) => a.minutes - b.minutes);

    // 查找大于等于请求分钟数的最小档位（向上取值）
    let pricePerEnergy = sortedPrices[sortedPrices.length - 1].price; // 默认使用最高档位

    for (const config of sortedPrices) {
      if (config.minutes >= minutes) {
        pricePerEnergy = config.price;
        break;
      }
    }

    // 如果请求的分钟数小于最小档位，抛出异常
    if (minutes < sortedPrices[0].minutes) {
      pricePerEnergy = sortedPrices[0].price;
    }

    // 计算总价格（SUN）= 能量数量 × 单价
    return energyAmount * pricePerEnergy;
  }

  /**
   * 转换为响应对象
   */
  private toRentResponse(order: any): RentEnergyResponse {
    return {
      orderNo: order.orderNo,
      energyAmount: order.energyAmount,
      receiverAddress: order.receiverAddress,
      price: Number(TronUtil.fromSun(order.price)),
      duration: order.duration,
    };
  }
}
