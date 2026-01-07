import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { UserWalletEntity } from '@/entities/user-wallet.entity';
import { UserWalletLogEntity } from '@/entities/user-wallet-log.entity';
import { WalletLogType, WalletStatus, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { WalletResponse, WalletTokenInfo } from '../vo';
import { ChainTokenService } from '@/modules/chain/services/token.service';

export interface editBalanceParams {
  userId: number;
  tokenId: number;
  amount: number;
  type: WalletLogType;
  orderId: number;
  remark?: string;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(UserWalletEntity)
    private readonly userWalletRepository: Repository<UserWalletEntity>,
    private readonly tokenService: ChainTokenService,
  ) {}

  /**
   * 验证金额格式和范围
   * @private
   */
  private validateAmount(amount: number, operation: string): bigint {
    const amountStr = amount.toString();
    if (!amountStr || !/^\d+$/.test(amountStr)) {
      throw new BusinessException(ErrorCode.ErrAmountInvalid);
    }

    let bigIntAmount: bigint;
    try {
      bigIntAmount = BigInt(amountStr);
    } catch (error) {
      throw new BusinessException(ErrorCode.ErrAmountInvalid);
    }

    if (bigIntAmount <= 0n) {
      throw new BusinessException(ErrorCode.ErrAmountMustPositive);
    }

    return bigIntAmount;
  }

  /**
   * 使用原子操作增加用户钱包余额
   * @param queryRunner 事务查询器
   * @param params 增加参数
   */
  async addBalance(queryRunner: QueryRunner, params: editBalanceParams): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const addAmount = this.validateAmount(amount, '增加');

    // 尝试原子更新现有记录
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        balance: () => `balance + ${addAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .execute();

    let userWallet: UserWalletEntity;
    let beforeBalance: number;

    if (updateResult.affected === 0) {
      // 记录不存在，创建新记录
      try {
        userWallet = await this.createNewWallet(
          queryRunner,
          userId,
          tokenId,
          Number(addAmount.toString()),
        );
        beforeBalance = 0;
      } catch (error) {
        // 唯一索引冲突，直接抛出异常
        throw new BusinessException(ErrorCode.ErrOperationConflict);
      }
    } else {
      // 更新成功，获取更新后的记录
      userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });
      if (!userWallet) {
        throw new BusinessException(ErrorCode.ErrWalletUpdateFailed);
      }

      beforeBalance = Number((BigInt(userWallet.balance) - addAmount).toString());
    }

    // 创建钱包变动日志
    await this.createWalletLog(queryRunner, params, beforeBalance, userWallet.balance);

    return userWallet;
  }

  /**
   * 使用原子操作减少用户钱包余额
   * @param queryRunner 事务查询器
   * @param params 减少参数
   */
  async subBalance(queryRunner: QueryRunner, params: editBalanceParams): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const subAmount = this.validateAmount(amount, '减少');

    // 尝试原子更新现有记录，同时检查余额是否足够
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        balance: () => `balance - ${subAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .andWhere(`balance - ${subAmount.toString()} >= 0`)
      .execute();

    if (updateResult.affected === 0) {
      // 记录不存在或余额不足
      const existingWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });

      if (!existingWallet) {
        throw new BusinessException(ErrorCode.ErrWalletNotFound);
      } else {
        throw new BusinessException(ErrorCode.ErrBalanceInsufficient);
      }
    }

    // 更新成功，获取更新后的记录
    const userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
      where: { userId, tokenId },
    });
    if (!userWallet) {
      throw new BusinessException(ErrorCode.ErrWalletUpdateFailed);
    }

    const beforeBalance = Number((BigInt(userWallet.balance) + subAmount).toString());

    // 创建钱包变动日志（记录为负数表示减少）
    await this.createWalletLog(
      queryRunner,
      {
        ...params,
        amount: -Number(subAmount.toString()), // 日志中记录为负数
      },
      beforeBalance,
      userWallet.balance,
    );

    return userWallet;
  }

  /**
   * 冻结用户钱包余额（可用余额转冻结余额）
   * @param queryRunner 事务查询器
   * @param params 冻结参数
   */
  async freezeBalance(
    queryRunner: QueryRunner,
    params: editBalanceParams,
  ): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const freezeAmount = this.validateAmount(amount, '冻结');

    // 原子操作：减少可用余额，增加冻结余额
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        balance: () => `balance - ${freezeAmount.toString()}`,
        frozenBalance: () => `frozen_balance + ${freezeAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .andWhere(`balance - ${freezeAmount.toString()} >= 0`)
      .execute();

    if (updateResult.affected === 0) {
      const existingWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });

      if (!existingWallet) {
        throw new BusinessException(ErrorCode.ErrWalletNotFound);
      } else {
        throw new BusinessException(ErrorCode.ErrBalanceInsufficient);
      }
    }

    const userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
      where: { userId, tokenId },
    });
    if (!userWallet) {
      throw new BusinessException(ErrorCode.ErrWalletUpdateFailed);
    }

    return userWallet;
  }

  /**
   * 解冻用户钱包余额（冻结余额转可用余额）
   * @param queryRunner 事务查询器
   * @param params 解冻参数
   */
  async unfreezeBalance(
    queryRunner: QueryRunner,
    params: editBalanceParams,
  ): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const unfreezeAmount = this.validateAmount(amount, '解冻');

    // 原子操作：减少冻结余额，增加可用余额
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        balance: () => `balance + ${unfreezeAmount.toString()}`,
        frozenBalance: () => `frozen_balance - ${unfreezeAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .andWhere(`frozen_balance - ${unfreezeAmount.toString()} >= 0`)
      .execute();

    if (updateResult.affected === 0) {
      const existingWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });

      if (!existingWallet) {
        throw new BusinessException(ErrorCode.ErrWalletNotFound);
      } else {
        throw new BusinessException(ErrorCode.ErrFrozenBalanceInsufficient);
      }
    }

    const userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
      where: { userId, tokenId },
    });
    if (!userWallet) {
      throw new BusinessException(ErrorCode.ErrWalletUpdateFailed);
    }

    return userWallet;
  }

  /**
   * 扣减冻结余额（直接减少冻结余额）
   * @param queryRunner 事务查询器
   * @param params 扣减参数
   */
  async subFrozenBalance(
    queryRunner: QueryRunner,
    params: editBalanceParams,
  ): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const subAmount = this.validateAmount(amount, '扣减');

    // 原子操作：直接减少冻结余额
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        frozenBalance: () => `frozen_balance - ${subAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .andWhere(`frozen_balance - ${subAmount.toString()} >= 0`)
      .execute();

    if (updateResult.affected === 0) {
      const existingWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });

      if (!existingWallet) {
        throw new BusinessException(ErrorCode.ErrWalletNotFound);
      } else {
        throw new BusinessException(ErrorCode.ErrFrozenBalanceInsufficient);
      }
    }

    const userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
      where: { userId, tokenId },
    });
    if (!userWallet) {
      throw new BusinessException(ErrorCode.ErrWalletUpdateFailed);
    }

    const beforeBalance = Number((BigInt(userWallet.frozenBalance) + subAmount).toString());

    // 创建钱包变动日志（记录为负数表示减少）
    await this.createWalletLog(
      queryRunner,
      {
        ...params,
        amount: -Number(subAmount.toString()), // 日志中记录为负数
      },
      beforeBalance,
      userWallet.frozenBalance,
    );

    return userWallet;
  }

  /**
   * 创建钱包变动日志的私有方法
   * @private
   */
  private async createWalletLog(
    queryRunner: QueryRunner,
    params: editBalanceParams,
    beforeBalance: number,
    afterBalance: number,
  ): Promise<void> {
    const { userId, tokenId, amount, type, orderId, remark } = params;

    const walletLog = queryRunner.manager.create(UserWalletLogEntity, {
      userId,
      tokenId,
      type,
      amount,
      beforeBalance,
      afterBalance,
      orderId: orderId || 0,
      remark,
    });

    await queryRunner.manager.save(UserWalletLogEntity, walletLog);
  }

  /**
   * 创建新钱包记录的私有方法
   * @private
   */
  private async createNewWallet(
    queryRunner: QueryRunner,
    userId: number,
    tokenId: number,
    balance: number,
  ): Promise<UserWalletEntity> {
    const userWallet = queryRunner.manager.create(UserWalletEntity, {
      userId,
      tokenId,
      balance,
      frozenBalance: 0,
      status: WalletStatus.ACTIVE,
    });

    await queryRunner.manager.save(UserWalletEntity, userWallet);
    return userWallet;
  }

  /**
   * 获取用户钱包余额
   */
  async getUserBalance(userId: number, tokenId: number): Promise<UserWalletEntity | null> {
    return await this.userWalletRepository.findOne({
      where: { userId, tokenId },
    });
  }

  /**
   * 获取用户所有钱包
   */
  async getAll(userId: number): Promise<UserWalletEntity[]> {
    return await this.userWalletRepository.find({
      where: { userId },
      order: { tokenId: 'ASC' },
    });
  }

  /**
   * 获取用户所有钱包（包含代币信息）
   */
  async getUserWalletsWithToken(userId: number): Promise<WalletResponse[]> {
    const wallets = await this.userWalletRepository
      .createQueryBuilder('wallet')
      .where('wallet.userId = :userId', { userId })
      .orderBy('wallet.tokenId', 'ASC')
      .getMany();

    if (wallets.length === 0) {
      return [];
    }

    // 使用 TokenService 一次性获取所有代币信息（带缓存）
    const allTokens = await this.tokenService.getChainTokenData();
    const tokenMap = new Map(allTokens.map((t) => [t.id, t]));

    // 组装返回数据
    return wallets.map((wallet) => {
      const token = tokenMap.get(wallet.tokenId);
      return new WalletResponse({
        token: new WalletTokenInfo({
          code: token?.code || '',
          name: token?.name || '',
          logo: token?.logo || '',
        }),
        balance: wallet.balance,
        frozenBalance: wallet.frozenBalance,
      });
    });
  }
}
