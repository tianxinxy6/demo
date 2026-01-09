import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@/constants';
import { TronUtil } from '@/utils/tron.util';
import { BaseCollectService } from './base.service';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TransactionCollectTronEntity } from '@/entities/txs/collect/transaction-tron.entity';
import { DelegateService } from '@/modules/order/services';

/**
 * TRON 归集服务
 * 处理 TRON 链的资金归集（包括 TRX 和 TRC20 代币）
 *
 * 继承自 BaseCollectService，自动获得父类的所有依赖注入
 * 不需要构造函数
 */
@Injectable()
export class TronCollectService extends BaseCollectService {
  protected readonly chainCode = 'TRON';

  private tronUtil: TronUtil;
  private rpcUrl: string;

  constructor(private readonly delegateService: DelegateService) {
    super();
  }

  protected buildEntity(): TransactionCollectTronEntity {
    return new TransactionCollectTronEntity();
  }

  /**
   * 初始化 TRON 连接
   */
  protected async init(): Promise<void> {
    const tronConfig = this.configService.get('tron');
    this.rpcUrl = tronConfig.rpcUrl;
    this.tronUtil = new TronUtil(tronConfig.rpcUrl);
  }

  /**
   * 获取余额
   */
  protected async getBalance(address: string, contract?: string): Promise<bigint> {
    try {
      if (contract) {
        return BigInt(await this.tronUtil.getTRC20Balance(address, contract));
      }
      return BigInt(await this.tronUtil.getTRXBalance(address));
    } catch (error) {
      this.logger.error(`Get balance failed for ${address}:`, error.message);
      throw error;
    }
  }

  async activateAddress(tx: BaseTransactionEntity): Promise<void> {
    await this.init();
    if (await this.tronUtil.checkAddressActivated(tx.to)) {
      return;
    }

    // 往地址中转 0.1 TRX 激活
    const activationAmount = 100_000;
    try {
      const privateKey = await this.getEnergyWalletPrivateKey();
      if (!privateKey) {
        this.logger.error('Failed to get energy wallet private key');
        return;
      }

      const tronUtil = new TronUtil(this.rpcUrl, privateKey);

      tronUtil
        .sendTrx(tx.to, activationAmount)
        .then((txHash) => {
          this.logger.debug(`Activated address ${tx.to} with tx: ${txHash}`);
        })
        .catch((error) => {
          this.logger.error(`Fund TRX failed:`, TronUtil.parseMessage(error.message));
        });
    } catch (error) {
      this.logger.error(`Fund TRX failed:`, error.message);
    }
  }

  /**
   * 执行归集交易
   */
  protected async executeCollect(tx: BaseTransactionEntity, privateKey: string): Promise<void> {
    try {
      this.tronUtil.setPrivateKey(privateKey);

      if (tx.contract) {
        return await this.collectTRC20(tx, this.editTxStatus.bind(this));
      }
      return await this.collectTRX(tx, this.editTxStatus.bind(this));
    } catch (error) {
      this.logger.error(`Execute collect failed for ${tx.from}:`, error.message);
    }
  }

  /**
   * 归集 TRX
   */
  private async collectTRX(
    relTx: BaseTransactionEntity,
    callback: (txID: number, data: any) => void,
  ): Promise<void> {
    try {
      // 获取账户余额
      const totalAmount = await this.getBalance(relTx.to);

      // 计算需要燃烧的手续费
      const actualFee = await this.tronUtil.calculateTrxTransFee(
        relTx.to,
        this.collectAddress,
        Number(totalAmount),
      );
      // 需要手续费则跳过，等待带宽恢复后再归集
      if (actualFee > 0) {
        this.logger.debug(`Fee is not enough to collect: ${actualFee}`);
        return;
      }

      // 计算可转账金额
      const transferAmount = totalAmount - actualFee;
      if (transferAmount <= 0n) {
        this.logger.warn(`Transfer amount is zero or negative: ${transferAmount}`);
        return;
      }

      this.tronUtil
        .sendTrx(this.collectAddress, Number(transferAmount))
        .then(async (hash) => {
          // 保存归集交易记录
          const txEntity = this.buildCollectEntity(relTx);
          txEntity.hash = hash;
          txEntity.amount = Number(transferAmount);
          txEntity.gasFee = Number(actualFee); // 实际燃烧的 TRX 费用
          const txId = await this.saveTx(txEntity, relTx);

          // 监听交易确认
          this.watchTx(hash, (status) => {
            callback(txId, { status });
          });
        })
        .catch((error) => {
          this.logger.error(`Send TRX failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Collect TRX failed:`, error.message);
    }
  }

  /**
   * 归集 TRC20
   */
  private async collectTRC20(
    relTx: BaseTransactionEntity,
    callback: (txID: number, data: any) => void,
  ): Promise<void> {
    try {
      // 计算交易所需的手续费
      const gasInfo = await this.tronUtil.calculateTrc20TransFee(
        relTx.to,
        relTx.contract,
        this.collectAddress,
        Number(relTx.amount),
      );

      // 账户带宽不足，等待带宽恢复后再归集
      if (gasInfo.bandwidthShortage > 0) {
        this.logger.debug(`Bandwidth is not enough to collect: ${gasInfo.bandwidthShortage}`);
        return;
      }

      if (gasInfo.energyShortage > 0) {
        // 能量不足，租借能量支付手续费
        await this.delegateService.rentEnergy(relTx.to, gasInfo.energyShortage, 1800);
      }

      await this.transferTRC20Token(relTx, 0, callback);
    } catch (error) {
      this.logger.error(`Collect TRC20 failed:`, error.message);
    }
  }

  /**
   * 执行 TRC20 代币转账
   */
  private async transferTRC20Token(
    relTx: BaseTransactionEntity,
    gasFee: number,
    callback: (txID: number, data: any) => void,
  ): Promise<void> {
    try {
      const balance = await this.getBalance(relTx.to, relTx.contract);
      if (balance <= 0n) {
        this.logger.warn(`No TRC20 balance to collect for address: ${relTx.to}`);
        return;
      }

      this.tronUtil
        .sendTrc20(this.collectAddress, Number(balance), relTx.contract)
        .then(async (txHash) => {
          // 保存归集交易记录
          const txEntity = this.buildCollectEntity(relTx) as TransactionCollectTronEntity;
          txEntity.hash = txHash;
          txEntity.amount = Number(balance);
          txEntity.gasFee = gasFee;
          const txId = await this.saveTx(txEntity, relTx);

          // 监听交易确认
          this.watchTx(txHash, (status) => {
            callback(txId, { status });
          });
        })
        .catch((error) => {
          this.logger.error(`Send TRC20 token failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Transfer TRC20 token failed:`, error.message);
      throw error;
    }
  }

  /**
   * 补充 TRX 费用
   */
  private async fundTrx(
    toAddress: string,
    gasFee: bigint,
    callback: (from: string, txHash: string, status: number) => void,
  ): Promise<void> {
    try {
      const feePrivateKey = await this.getGasWalletPrivateKey();
      if (!feePrivateKey) {
        this.logger.error('Failed to get fee wallet private key');
        return;
      }

      const feeTronUtil = new TronUtil(this.rpcUrl, feePrivateKey);
      const feeWalletAddress = feeTronUtil.getFromAddress();
      if (!feeWalletAddress) {
        this.logger.error('Failed to get fee wallet address');
        return;
      }
      const balance = await feeTronUtil.getTRXBalance(feeWalletAddress);
      const feeWalletBalance = BigInt(balance);
      if (feeWalletBalance < gasFee) {
        this.logger.error(
          `Fee wallet insufficient: need ${Number(gasFee) / 1_000_000} TRX, ` +
            `has ${Number(feeWalletBalance) / 1_000_000} TRX`,
        );
        return;
      }

      feeTronUtil
        .sendTrx(toAddress, Number(gasFee))
        .then((txHash) => {
          this.logger.log(
            `TRX funded: ${Number(gasFee) / 1_000_000} TRX to ${toAddress}, tx: ${txHash}`,
          );

          // 监听交易确认并执行回调
          this.watchTx(txHash, (status) => {
            callback(feeWalletAddress, txHash, status);
          });
        })
        .catch((error) => {
          this.logger.error(`Fund TRX failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Fund TRX failed:`, error.message);
    }
  }

  /**
   * 监听交易确认状态
   * 使用 getTransaction 作为主要判断依据（更可靠）
   */
  private async watchTx(
    txHash: string,
    callback: (status: TransactionStatus) => void,
    timeoutMs: number = 9 * 1000,
    intervalMs: number = 3_000,
  ): Promise<void> {
    const start = Date.now();

    try {
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

      this.logger.error(`Transaction confirmation timeout: ${txHash}`);
    } catch (error) {
      this.logger.error(`watchTx failed for ${txHash}:`, error.message);
      callback(TransactionStatus.FAILED);
    }
  }
}
