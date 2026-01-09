import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { OrderDelegateEntity } from '@/entities/order-delegate.entity';
import { DelegateStatus, ErrorCode } from '@/constants';
import { CreateDelegateOrderDto } from '../dto/delegate.dto';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { AppConfigService } from '@/shared/services/config.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { generateOrderNo, TronUtil } from '@/utils';
import { ConfigService } from '@nestjs/config';
import { ChainTokenService } from '@/modules/chain/services/token.service';

/**
 * 委托订单服务
 * 职责：管理能量委托订单的创建、更新、查询
 */
@Injectable()
export class DelegateService {
  private readonly logger = new Logger(DelegateService.name);
  private readonly tronUtil: TronUtil;

  constructor(
    @InjectRepository(OrderDelegateEntity)
    private readonly delegateRepo: Repository<OrderDelegateEntity>,
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly chainTokenService: ChainTokenService,
    private readonly dataSource: DataSource,
  ) {
    const rpcUrl = this.configService.get<string>('tron.rpcUrl');
    this.tronUtil = new TronUtil(rpcUrl);
  }

  /**
   * 创建委托订单（在事务中）
   */
  async create(
    queryRunner: QueryRunner,
    token: IChainToken,
    dto: CreateDelegateOrderDto,
  ): Promise<OrderDelegateEntity> {
    const order = queryRunner.manager.create(OrderDelegateEntity, {
      orderNo: dto.orderNo,
      userId: dto.userId,
      receiverAddress: dto.receiverAddress,
      energyAmount: dto.energyAmount,
      trxAmount: dto.trxAmount,
      duration: dto.duration,
      price: dto.price,
      token: token.code,
      tokenId: token.id,
      status: DelegateStatus.Pending,
    });

    return await queryRunner.manager.save(OrderDelegateEntity, order);
  }

  /**
   * 系统租赁能量
   */
  async rentEnergy(
    receiverAddress: string,
    energyAmount: number,
    duration: number = 180,
  ): Promise<void> {
    const ownerAddress = await this.appConfigService.getEnergyOwnerWallet();
    if (!ownerAddress) {
      throw new BusinessException(ErrorCode.ErrAddressInvalid);
    }

    // 7. 获取系统能量钱包私钥
    const sysPrivateKey = await this.sysWalletService.getEnergyWallet();
    this.tronUtil.setPrivateKey(sysPrivateKey);

    // 4. 检查平台可用能量是否足够
    const platformResource = await this.tronUtil.getAccountResource();
    if (platformResource.energy < energyAmount) {
      throw new BusinessException(ErrorCode.ErrDelegateEnergyInsufficient);
    }

    const trxAmount = await this.tronUtil.convertEnergyToTrx(ownerAddress, energyAmount);
    if (trxAmount == 0) {
      throw new BusinessException(ErrorCode.ErrDelegateEnergyInsufficient);
    }

    const token = await this.chainTokenService.getAddressByCode('TRX');

    // 5. 使用事务确保原子性
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.create(queryRunner, token, {
        orderNo: generateOrderNo(),
        userId: 0,
        receiverAddress,
        trxAmount,
        energyAmount,
        duration,
        price: 0,
      });

      // 9. 执行链上能量委托
      const result = await this.tronUtil.delegateResourceWithPermission(
        ownerAddress,
        receiverAddress,
        trxAmount,
      );
      if (!result.result) {
        throw new BusinessException(ErrorCode.ErrTransactionExecuteFailed);
      }

      // 10. 更新订单为成功状态
      await this.updateSuccess(queryRunner, order, result.txid, duration);

      // 11. 提交事务
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BusinessException(ErrorCode.ErrTransactionExecuteFailed);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 更新订单为成功状态（在事务中）
   */
  async updateSuccess(
    queryRunner: QueryRunner,
    order: OrderDelegateEntity,
    txHash: string,
    durationSeconds: number,
  ): Promise<void> {
    if (order.status !== DelegateStatus.Pending) {
      throw new BusinessException(ErrorCode.ErrDelegateStatusInvalid);
    }
    order.status = DelegateStatus.Success;
    order.hash = txHash;
    order.expireAt = new Date(Date.now() + durationSeconds * 1000);
    await queryRunner.manager.save(OrderDelegateEntity, order);
  }

  /**
   * 更新订单为失败状态
   */
  async updateFailed(order: OrderDelegateEntity, reason: string): Promise<void> {
    if (order.status !== DelegateStatus.Success) {
      throw new BusinessException(ErrorCode.ErrDelegateStatusInvalid);
    }
    order.status = DelegateStatus.Failed;
    order.failReason = reason;
    await this.delegateRepo.save(order);
  }

  /**
   * 更新订单为已回收状态（在事务中）
   */
  async updateReclaimed(queryRunner: QueryRunner, order: OrderDelegateEntity): Promise<void> {
    if (order.status !== DelegateStatus.Success) {
      throw new BusinessException(ErrorCode.ErrDelegateStatusInvalid);
    }
    order.status = DelegateStatus.Reclaimed;
    order.finishedAt = new Date();
    await queryRunner.manager.save(OrderDelegateEntity, order);
  }

  /**
   * 根据订单号和用户ID查询订单
   */
  async findByOrderNo(orderNo: string, userId: number): Promise<OrderDelegateEntity | null> {
    return await this.delegateRepo.findOne({
      where: { orderNo, userId },
    });
  }

  /**
   * 根据用户ID查询订单列表
   */
  async findByUserId(userId: number, limit = 20): Promise<OrderDelegateEntity[]> {
    return await this.delegateRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 查询已过期但未回收的订单
   */
  async findExpiredOrders(limit = 20): Promise<OrderDelegateEntity[]> {
    return await this.delegateRepo
      .createQueryBuilder('order')
      .where('order.status = :status', { status: DelegateStatus.Success })
      .andWhere('order.expireAt < :now', { now: new Date() })
      .orderBy('order.expireAt', 'ASC')
      .take(limit)
      .getMany();
  }
}
