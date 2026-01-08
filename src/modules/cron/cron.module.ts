import { Module } from '@nestjs/common';
import { ScanTask } from './tasks/scan.task';
import { ConfirmTask } from './tasks/confirm.task';
import { WithdrawTask } from './tasks/withdraw.task';
import { MarketPriceTask } from './tasks/market-price.task';
import { DelegateReclaimTask } from './tasks/delegate-reclaim.task';
import { TransactionModule } from '../transaction/transaction.module';
import { MarketModule } from '../market/market.module';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../user/user.module';
import { SysModule } from '../sys/sys.module';

/**
 * 任务模块 - 管理定时任务
 */
@Module({
  imports: [
    TransactionModule,
    MarketModule,
    OrderModule, // 导入OrderModule以获取DelegateService
    UserModule, // 导入UserModule以获取WalletService
    SysModule, // 导入SysModule以获取SysWalletAddressService
  ],
  providers: [
    // 定时任务
    ScanTask,
    ConfirmTask,
    // WithdrawTask,
    // MarketPriceTask,
    DelegateReclaimTask, // 委托订单能量回收任务
  ],
})
export class TaskModule {}
