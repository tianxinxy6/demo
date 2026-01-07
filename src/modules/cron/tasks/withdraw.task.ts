import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TronWithdrawService } from '@/modules/transaction/services/withdraw/tron.service';

/**
 * 提现处理定时任务
 * 处理已审核通过的提现订单，执行链上转账
 */
@Injectable()
export class WithdrawTask {
  constructor(private readonly tronWithdrawService: TronWithdrawService) {}

  /**
   * TRON 提现处理 - 每30秒执行一次
   */
  @Cron('*/30 * * * * *')
  async processTron(): Promise<void> {
    await this.tronWithdrawService.process();
  }
}
