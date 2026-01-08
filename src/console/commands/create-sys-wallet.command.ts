import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { SysWalletType } from '@/constants';

/**
 * 创建系统钱包命令
 * 使用方式:
 * npm run console create:sys-wallet -- --type=1  # 创建手续费钱包
 * npm run console create:sys-wallet -- --type=2  # 创建提现钱包
 * npm run console create:sys-wallet -- --type=3  # 创建能量钱包
 * npm run console create:sys-wallet -- --all     # 创建所有类型钱包
 */
interface CreateSysWalletOptions {
  type?: number;
  all?: boolean;
}

@Injectable()
@Command({
  name: 'create:sys-wallet',
  description: '创建系统钱包地址',
})
export class CreateSysWalletCommand extends CommandRunner {
  private readonly logger = new Logger(CreateSysWalletCommand.name);

  constructor(private readonly sysWalletService: SysWalletAddressService) {
    super();
  }

  async run(passedParams: string[], options?: CreateSysWalletOptions): Promise<void> {
    try {
      if (options?.all) {
        // 创建所有类型的系统钱包
        await this.createAllWallets();
      } else if (options?.type) {
        // 创建指定类型的钱包
        await this.createWallet(options.type);
      } else {
        console.log('请指定钱包类型或使用 --all 创建所有钱包');
        console.log('');
        console.log('使用示例:');
        console.log('  npm run console create:sys-wallet -- --type=1  # 手续费钱包');
        console.log('  npm run console create:sys-wallet -- --type=2  # 提现钱包');
        console.log('  npm run console create:sys-wallet -- --type=3  # 能量钱包');
        console.log('  npm run console create:sys-wallet -- --all     # 创建所有钱包');
        console.log('');
        console.log('钱包类型说明:');
        console.log('  1 - 手续费钱包 (Fee Wallet)');
        console.log('  2 - 提现钱包 (Withdraw Wallet)');
        console.log('  3 - 能量钱包 (Energy Wallet)');
        return;
      }

      console.log('\n✅ 系统钱包创建完成!');
    } catch (error) {
      this.logger.error(`创建系统钱包失败: ${error.message}`, error.stack);
      console.error(`\n❌ 错误: ${error.message}`);
      throw error;
    }
  }

  private async createAllWallets(): Promise<void> {
    console.log('开始创建所有系统钱包...\n');

    const walletTypes = [
      { type: SysWalletType.Fee, name: '手续费钱包' },
      { type: SysWalletType.Widthdraw, name: '提现钱包' },
      { type: SysWalletType.Energy, name: '能量钱包' },
    ];

    for (const wallet of walletTypes) {
      await this.createWalletWithName(wallet.type, wallet.name);
    }
  }

  private async createWallet(type: number): Promise<void> {
    let walletName: string;

    switch (type) {
      case SysWalletType.Fee:
        walletName = '手续费钱包';
        break;
      case SysWalletType.Widthdraw:
        walletName = '提现钱包';
        break;
      case SysWalletType.Energy:
        walletName = '能量钱包';
        break;
      default:
        console.error(`❌ 无效的钱包类型: ${type}`);
        console.log('有效的钱包类型: 1=手续费钱包, 2=提现钱包, 3=能量钱包');
        return;
    }

    await this.createWalletWithName(type, walletName);
  }

  private async createWalletWithName(type: SysWalletType, name: string): Promise<void> {
    console.log(`正在创建 ${name} (类型=${type})...`);

    try {
      await this.sysWalletService.create(type);
      console.log(`✓ ${name} 创建成功`);
    } catch (error) {
      if (error.message?.includes('already exists') || error.code === 'ER_DUP_ENTRY') {
        console.log(`⚠ ${name} 已存在，跳过创建`);
      } else {
        console.error(`✗ ${name} 创建失败: ${error.message}`);
        throw error;
      }
    }
  }

  @Option({
    flags: '-t, --type <type>',
    description: '钱包类型 (1=手续费, 2=提现, 3=能量)',
  })
  parseType(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: '-a, --all',
    description: '创建所有类型的系统钱包',
  })
  parseAll(): boolean {
    return true;
  }
}
