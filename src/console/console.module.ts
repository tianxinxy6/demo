import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreateSysWalletCommand } from './commands/create-sys-wallet.command';
import { DelegateEnergyCommand } from './commands/delegate-energy.command';
import { UndelegateEnergyCommand } from './commands/undelegate-energy.command';
import { FreezeBalanceCommand } from './commands/freeze-balance.command';
import { UnfreezeBalanceCommand } from './commands/unfreeze-balance.command';
import { WalletInfoCommand } from './commands/wallet-info.command';
import { VoteWitnessCommand } from './commands/vote-witness.command';
import { ClaimRewardsCommand } from './commands/claim-rewards.command';
import { SysModule } from '@/modules/sys/sys.module';
import { SharedModule } from '@/shared/shared.module';
import config from '@/config';

/**
 * Console Module - 命令行工具模块
 * 类似于 Laravel 的 Artisan 命令
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      cache: true,
      load: [...Object.values(config)],
    }),
    SysModule,
    SharedModule,
  ],
  providers: [
    CreateSysWalletCommand,
    DelegateEnergyCommand,
    UndelegateEnergyCommand,
    FreezeBalanceCommand,
    UnfreezeBalanceCommand,
    WalletInfoCommand,
    VoteWitnessCommand,
    ClaimRewardsCommand,
  ],
})
export class ConsoleModule {}
