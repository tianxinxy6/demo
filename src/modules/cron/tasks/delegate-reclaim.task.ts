import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DelegateService } from '@/modules/order/services/delegate.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { TronUtil } from '@/utils/tron.util';
import { ConfigService } from '@nestjs/config';
import { OrderDelegateEntity } from '@/entities/order-delegate.entity';
import { AppConfigService } from '@/shared/services/config.service';
import { CronErrorHandler } from '@/common/decorators/cron-error-handler.decorator';

/**
 * 委托订单能量回收定时任务
 * 职责：扫描过期的委托订单，自动执行能量回收
 */
@Injectable()
export class DelegateReclaimTask {
  private readonly logger = new Logger(DelegateReclaimTask.name);
  private readonly tronUtil: TronUtil;
  private isRunning = false;

  constructor(
    private readonly delegateService: DelegateService,
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
  ) {
    const rpcUrl = this.configService.get<string>('tron.rpcUrl');
    this.tronUtil = new TronUtil(rpcUrl);
  }

  /**
   * 每分钟扫描一次过期的委托订单并执行能量回收
   * Cron表达式: 每分钟的第0秒执行
   */
  @Cron(CronExpression.EVERY_MINUTE)
  @CronErrorHandler('能量回收任务')
  async reclaimExpiredOrders(): Promise<void> {
    // 防止并发执行
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      // 查询过期订单（每次处理10个，避免一次性处理过多）
      const expiredOrders = await this.delegateService.findExpiredOrders();
      if (expiredOrders.length === 0) {
        return;
      }

      this.logger.log(`发现 ${expiredOrders.length} 个过期订单，开始执行能量回收`);

      // 获取系统钱包私钥
      const sysPrivateKey = await this.sysWalletService.getEnergyWallet();
      this.tronUtil.setPrivateKey(sysPrivateKey);

      const ownerAddress = await this.appConfigService.getEnergyOwnerWallet();
      if (!ownerAddress) {
        this.logger.warn('能量所有者地址未配置，无法执行回收');
        return;
      }

      for (const order of expiredOrders) {
        await this.reclaimSingleOrder(order, ownerAddress);
        // 避免过快调用，稍作休息
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      this.logger.error(`扫描过期订单失败: ${error.message}`, error.stack);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 回收单个订单的能量
   */
  private async reclaimSingleOrder(
    order: OrderDelegateEntity,
    ownerAddress: string,
  ): Promise<void> {
    const result = await this.tronUtil.undelegateResourceWithPermission(
      ownerAddress,
      order.receiverAddress,
      order.trxAmount,
    );
    if (!result.result) {
      // 存储解析后的 message
      const fail = TronUtil.parseMessage(result.message);
      await this.delegateService.updateFailed(order, fail);
      return;
    }

    // 更新订单状态为已回收
    await this.delegateService.updateReclaimed(order);
  }
}
