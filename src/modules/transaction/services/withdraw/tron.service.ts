import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@/constants';
import { TronUtil } from '@/utils/tron.util';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { BaseWithdrawService } from './base.service';
import { TransactionOutTronEntity } from '@/entities/txs/withdraw/transaction-tron.entity';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { DelegateService } from '@/modules/order/services';

/**
 * TRON 提现转账服务
 * 处理 TRON 链的提现转账（包括 TRX 和 TRC20 代币）
 */
@Injectable()
export class TronWithdrawService extends BaseWithdrawService {
  protected readonly chainCode = 'TRON';

  private tronUtil: TronUtil;

  constructor(private readonly delegateService: DelegateService) {
    super();
  }

  protected buildEntity(): BaseTransactionEntity {
    return new TransactionOutTronEntity();
  }

  /**
   * 初始化 TRON 连接
   * @param privateKey 私钥
   * @returns 钱包地址
   */
  protected async init(privateKey: string): Promise<void> {
    const tronConfig = this.configService.get('tron');
    this.tronUtil = new TronUtil(tronConfig.rpcUrl, privateKey);
    const address = this.tronUtil.getFromAddress();
    if (!address) {
      throw new Error('Invalid withdraw wallet private key');
    }
    this.addressFrom = address;
  }

  /**
   * 获取余额
   */
  protected async getBalance(address: string, contract?: string): Promise<bigint> {
    if (contract) {
      return BigInt(await this.tronUtil.getTRC20Balance(address, contract));
    }
    return BigInt(await this.tronUtil.getTRXBalance(address));
  }

  /**
   * 执行提现转账
   */
  protected async executetransfer(order: OrderWithdrawEntity): Promise<void> {
    // 如果是 TRC20 代币
    if (order.contract) {
      return await this.withdrawTRC20(order, this.editTxStatus.bind(this));
    } else {
      // TRX 原生币转账
      return await this.withdrawTRX(order, this.editTxStatus.bind(this));
    }
  }

  /**
   * 提现 TRX
   */
  private async withdrawTRX(
    order: OrderWithdrawEntity,
    callback: (txId: number, orderId: number, data: any) => void,
  ): Promise<void> {
    const amount = Number(order.actualAmount);

    const gasFee = await this.tronUtil.calculateTrxTransFee(this.addressFrom, order.to, amount);
    if (gasFee > 0) {
      this.logger.debug(`Fee is not enough to collect: ${gasFee}`);
      return;
    }

    this.tronUtil.sendTrx(order.to, amount).then(async (hash) => {
      // 创建提现交易记录
      const txEntity = this.buildWithdrawEntity(order);
      txEntity.hash = hash;
      txEntity.amount = amount;
      txEntity.gasFee = Number(gasFee);
      const txId = await this.saveTx(txEntity, order);

      // 监听交易确认
      this.watchTx(hash, (status, blockNumber) => {
        callback(txId, order.id, { status, blockNumber });
      });
    });
  }

  /**
   * 提现 TRC20
   */
  private async withdrawTRC20(
    order: OrderWithdrawEntity,
    callback: (txId: number, orderId: number, data: any) => void,
  ): Promise<void> {
    const amount = Number(order.actualAmount);

    const gasInfo = await this.tronUtil.calculateTrc20TransFee(
      this.addressFrom,
      order.contract,
      order.to,
      amount,
    );

    // 账户带宽不足，等待带宽恢复后再归集
    if (gasInfo.bandwidthShortage > 0) {
      this.logger.debug(`Bandwidth is not enough to collect: ${gasInfo.bandwidthShortage}`);
      return;
    }

    if (gasInfo.energyShortage > 0) {
      // 能量不足，租借能量支付手续费
      await this.delegateService.rentEnergy(this.addressFrom, gasInfo.energyShortage);
    }

    const gasFee = gasInfo.gas;

    this.tronUtil.sendTrc20(order.to, amount, order.contract).then(async (hash) => {
      // 创建提现交易记录
      const txEntity = this.buildWithdrawEntity(order);
      txEntity.hash = hash;
      txEntity.amount = amount;
      txEntity.gasFee = Number(gasFee);
      const txId = await this.saveTx(txEntity, order);

      // 监听交易确认
      this.watchTx(hash, (status, blockNumber) => {
        callback(txId, order.id, { status, blockNumber });
      });
    });
  }

  /**
   * 监听交易确认状态
   * 使用 getTransaction 作为主要判断依据（更可靠）
   */
  private async watchTx(
    txHash: string,
    callback: (status: TransactionStatus, blockNumber?: number) => void,
    timeoutMs: number = 9 * 1000,
    intervalMs: number = 3_000,
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      // 使用 getTransaction 检查状态（不依赖 getTransactionInfo）
      const tx = await this.tronUtil.getTransaction(txHash);
      if (!tx || !tx.txID) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }

      const status = tx.ret?.[0]?.contractRet;

      if (status === 'SUCCESS') {
        callback(TransactionStatus.CONFIRMED);
        return;
      } else if (status === 'REVERT') {
        callback(TransactionStatus.FAILED);
        return;
      } else {
        // 交易存在但还未确认
        this.logger.debug(`Transaction ${txHash} pending confirmation...`);
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
