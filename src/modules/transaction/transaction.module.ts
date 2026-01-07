import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderModule } from '@/modules/order/order.module';
import { ChainModule } from '@/modules/chain/chain.module';
import { UserModule } from '@/modules/user/user.module';
import { TronScanService } from './services/scan/tron.service';
import { TronConfirmService } from './services/confirm/tron.service';
import { TronCollectService } from './services/collect/tron.service';
import { SharedModule } from '@/shared/shared.module';
import { SysModule } from '../sys/sys.module';
import { TransactionTronEntity } from '@/entities/txs/deposit/transaction-tron.entity';
import { TransactionCollectTronEntity } from '@/entities/txs/collect/transaction-tron.entity';
import { TransactionOutTronEntity } from '@/entities/txs/withdraw/transaction-tron.entity';
import { TronWithdrawService } from './services/withdraw/tron.service';

const providers = [
  // 扫描服务
  TronScanService,
  // 确认服务
  TronConfirmService,
  // 归集服务
  TronCollectService,
  // 提现服务
  TronWithdrawService,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionTronEntity,
      TransactionCollectTronEntity,
      TransactionOutTronEntity,
    ]),
    OrderModule,
    ChainModule,
    UserModule,
    SharedModule,
    SysModule,
  ],
  providers,
  exports: providers,
})
export class TransactionModule {}
