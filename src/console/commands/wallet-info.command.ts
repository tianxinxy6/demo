import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TronUtil } from '@/utils/tron.util';

/**
 * 查看钱包信息命令
 * 使用方式:
 * npm run console wallet:info -- --address=<地址>
 */
interface WalletInfoOptions {
  address: string;
}

@Injectable()
@Command({
  name: 'wallet:info',
  description: '查看钱包地址的账户信息、资源信息和质押信息',
})
export class WalletInfoCommand extends CommandRunner {
  private readonly logger = new Logger(WalletInfoCommand.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async run(passedParams: string[], options?: WalletInfoOptions): Promise<void> {
    try {
      // 验证参数
      if (!options?.address) {
        this.showUsage();
        return;
      }

      // 验证地址格式
      if (!TronUtil.validateAddress(options.address)) {
        console.error(`❌ 无效的 TRON 地址: ${options.address}`);
        return;
      }

      // 获取 TRON RPC URL
      const rpcUrl = this.configService.get<string>('tron.rpcUrl');
      if (!rpcUrl) {
        console.error('❌ 未配置 TRON RPC URL');
        return;
      }

      const tronUtil = new TronUtil(rpcUrl);

      console.log('');
      console.log('━'.repeat(60));
      console.log(`📍 钱包地址: ${options.address}`);
      console.log('━'.repeat(60));
      console.log('');

      // 一次性获取所有需要的数据
      const [account, accountResources] = await Promise.all([
        tronUtil['tronWeb'].trx.getAccount(options.address),
        tronUtil['tronWeb'].trx.getAccountResources(options.address),
      ]);

      console.log('amount', account, accountResources);

      // 显示所有信息
      await this.showAccountInfo(account);
      console.log('');
      await this.showResourceInfo(accountResources);
      console.log('');
      await this.showStakeInfo(account);

      console.log('');
      console.log('━'.repeat(60));
      console.log('✅ 查询完成');
      console.log('━'.repeat(60));
    } catch (error) {
      console.error('');
      console.error('❌ 查询失败:', error.message);
      this.logger.error('查询钱包信息失败', error.stack);
    }
  }

  /**
   * 显示账户基本信息
   */
  private async showAccountInfo(account: any): Promise<void> {
    console.log('📊 账户信息');
    console.log('─'.repeat(60));

    try {
      if (!account || !account.address) {
        console.log('  ⚠️  账户未激活或不存在');
        return;
      }

      // 余额信息
      const balance = account.balance || 0;
      const balanceTrx = balance / 1_000_000;
      console.log(`  💰 TRX 余额: ${balanceTrx.toFixed(6)} TRX (${balance} SUN)`);

      // 创建时间
      if (account.create_time) {
        const createDate = new Date(account.create_time);
        console.log(`  📅 创建时间: ${createDate.toLocaleString('zh-CN')}`);
      }

      // 账户权限
      if (account.active_permission) {
        console.log(`  🔐 权限数量: ${account.active_permission.length}`);
      }

      // 投票信息
      if (account.votes && account.votes.length > 0) {
        console.log(`  🗳️  投票数量: ${account.votes.length}`);
      }

      // 账户类型（根据实际类型调整）
      if (account.type !== undefined && account.type !== null) {
        let accountType = '未知类型';
        // AccountType 是枚举类型，通常 0 或 Normal 表示普通账户
        if (typeof account.type === 'number') {
          accountType = account.type === 0 ? '普通账户' : '合约账户';
        } else {
          accountType = String(account.type);
        }
        console.log(`  📌 账户类型: ${accountType}`);
      }

      // 最新操作时间
      if (account.latest_opration_time) {
        const latestOpTime = new Date(account.latest_opration_time);
        console.log(`  ⏰ 最后操作: ${latestOpTime.toLocaleString('zh-CN')}`);
      }
    } catch (error) {
      console.log(`  ❌ 获取账户信息失败: ${error.message}`);
    }
  }

  /**
   * 显示资源信息
   */
  private async showResourceInfo(accountResources: any): Promise<void> {
    console.log('⚡ 资源信息');
    console.log('─'.repeat(60));

    try {
      if (!accountResources) {
        console.log('  ⚠️  无法获取资源信息');
        return;
      }

      // 能量信息
      // EnergyLimit 是总能量限制（有质押时才有）
      // EnergyUsed 是已使用的能量
      // tronPowerLimit 是投票权相关
      const energyLimit = accountResources.EnergyLimit || 0;
      const energyUsed = accountResources.EnergyUsed || 0;
      const energyAvailable = energyLimit - energyUsed;
      const energyUsagePercent =
        energyLimit > 0 ? ((energyUsed / energyLimit) * 100).toFixed(2) : '0.00';

      console.log('  ⚡ 能量 (Energy):');
      console.log(`     可用: ${energyAvailable.toLocaleString()}`);
      console.log(`     总量: ${energyLimit.toLocaleString()}`);
      console.log(`     已用: ${energyUsed.toLocaleString()} (${energyUsagePercent}%)`);

      // 如果有 tronPowerLimit，也显示投票权（说明有质押但能量可能被委托了）
      if (accountResources.tronPowerLimit) {
        console.log(
          `     💡 说明: 有 ${accountResources.tronPowerLimit.toLocaleString()} TRX 质押用于能量`,
        );
        if (energyLimit === 0) {
          console.log(`             但能量已全部委托给其他地址`);
        }
      }

      // 带宽信息
      const freeNetLimit = accountResources.freeNetLimit || 0;
      const freeNetUsed = accountResources.freeNetUsed || 0;
      const netLimit = accountResources.NetLimit || 0;
      const netUsed = accountResources.NetUsed || 0;

      const totalBandwidth = freeNetLimit + netLimit;
      const totalUsed = freeNetUsed + netUsed;
      const bandwidthAvailable = totalBandwidth - totalUsed;
      const bandwidthUsagePercent =
        totalBandwidth > 0 ? ((totalUsed / totalBandwidth) * 100).toFixed(2) : '0.00';

      console.log('  📡 带宽 (Bandwidth):');
      console.log(`     可用: ${bandwidthAvailable.toLocaleString()}`);
      console.log(`     总量: ${totalBandwidth.toLocaleString()}`);
      console.log(`     已用: ${totalUsed.toLocaleString()} (${bandwidthUsagePercent}%)`);

      if (freeNetLimit > 0) {
        console.log(`     └─ 免费带宽: ${freeNetLimit.toLocaleString()} (已用: ${freeNetUsed})`);
      }
      if (netLimit > 0) {
        console.log(`     └─ 质押带宽: ${netLimit.toLocaleString()} (已用: ${netUsed})`);
      }

      // 投票信息
      const voteLimit = accountResources.tronPowerLimit || 0;
      const voteUsed = accountResources.tronPowerUsed || 0;

      console.log('  🗳️  投票权 (TRON Power):');
      console.log(`     可用: ${(voteLimit - voteUsed).toLocaleString()}`);
      console.log(`     总量: ${voteLimit.toLocaleString()}`);
      console.log(
        `     已用: ${voteUsed.toLocaleString()} (${voteLimit > 0 ? ((voteUsed / voteLimit) * 100).toFixed(2) : '0.00'}%)`,
      );

      // 全网资源统计
      console.log('  🌐 全网资源统计:');
      if (accountResources.TotalEnergyLimit !== undefined) {
        const totalEnergyLimit = accountResources.TotalEnergyLimit;
        console.log(`     能量总量: ${totalEnergyLimit.toLocaleString()}`);
      }
      if (accountResources.TotalEnergyWeight !== undefined) {
        console.log(`     能量总权重: ${accountResources.TotalEnergyWeight.toLocaleString()}`);
      }
      if (accountResources.TotalNetLimit !== undefined) {
        const totalNetLimit = accountResources.TotalNetLimit;
        console.log(`     带宽总量: ${totalNetLimit.toLocaleString()}`);
      }
      if (accountResources.TotalNetWeight !== undefined) {
        console.log(`     带宽总权重: ${accountResources.TotalNetWeight.toLocaleString()}`);
      }
    } catch (error) {
      console.log(`  ❌ 获取资源信息失败: ${error.message}`);
    }
  }

  /**
   * 显示质押信息
   */
  private async showStakeInfo(account: any): Promise<void> {
    console.log('🔒 质押信息');
    console.log('─'.repeat(60));

    try {
      if (!account || !account.address) {
        console.log('  ⚠️  账户未激活或不存在');
        return;
      }

      let hasStake = false;

      // Stake 2.0 质押信息
      // frozenV2 数组中，每个元素可能只包含 amount 或只包含 type
      // 第一个元素通常是 amount，后续元素是对应的 type
      if (account.frozenV2 && account.frozenV2.length > 0) {
        hasStake = true;
        console.log('  📦 Stake 2.0 质押:');

        let totalStakedEnergy = 0;
        let totalStakedBandwidth = 0;
        let totalStakedTronPower = 0;

        for (const frozen of account.frozenV2) {
          if (frozen.amount !== undefined) {
            // 找到 type，配对使用之前的 amount
            const amountTrx = frozen.amount / 1_000_000;
            const type = frozen.type;

            if (type === 'ENERGY') {
              totalStakedEnergy += frozen.amount;
              console.log(`     ⚡ 能量质押: ${amountTrx.toFixed(6)} TRX (${frozen.amount} SUN)`);
            } else if (type === 'TRON_POWER') {
              totalStakedTronPower += frozen.amount;
              console.log(`     🔋 投票权质押: ${amountTrx.toFixed(6)} TRX (${frozen.amount} SUN)`);
            } else {
              totalStakedBandwidth += frozen.amount;
              console.log(`     📡 带宽质押: ${amountTrx.toFixed(6)} TRX (${frozen.amount} SUN)`);
            }
          }
        }

        const totalStaked = totalStakedEnergy + totalStakedBandwidth + totalStakedTronPower;
        const totalStakedTrx = totalStaked / 1_000_000;
        if (totalStaked > 0) {
          console.log(`     💎 总质押: ${totalStakedTrx.toFixed(6)} TRX`);
        }
      }

      // Stake 1.0 质押信息（兼容旧版）
      if (account.frozen && account.frozen.length > 0) {
        hasStake = true;
        console.log('  📦 Stake 1.0 质押 (旧版):');

        for (const frozen of account.frozen) {
          const amount = frozen.frozen_balance || 0;
          const amountTrx = amount / 1_000_000;
          const expireTime = frozen.expire_time
            ? new Date(frozen.expire_time).toLocaleString('zh-CN')
            : '未知';

          console.log(`     💰 金额: ${amountTrx.toFixed(6)} TRX`);
          console.log(`     ⏰ 到期: ${expireTime}`);
        }
      }

      // 能量相关质押（旧版）
      if (
        account.account_resource?.frozen_balance_for_energy &&
        account.account_resource.frozen_balance_for_energy.frozen_balance > 0
      ) {
        hasStake = true;
        const frozenBalance = account.account_resource.frozen_balance_for_energy.frozen_balance;
        const frozenBalanceTrx = frozenBalance / 1_000_000;
        const expireTime = account.account_resource.frozen_balance_for_energy.expire_time
          ? new Date(account.account_resource.frozen_balance_for_energy.expire_time).toLocaleString(
              'zh-CN',
            )
          : '未知';

        console.log('  ⚡ 能量质押 (旧版):');
        console.log(`     💰 金额: ${frozenBalanceTrx.toFixed(6)} TRX`);
        console.log(`     ⏰ 到期: ${expireTime}`);
      }

      // 委托资源信息 - 委托给别人的
      if (account.delegated_frozenV2_balance_for_bandwidth) {
        hasStake = true;
        const delegated = account.delegated_frozenV2_balance_for_bandwidth;
        const delegatedTrx = delegated / 1_000_000;
        console.log(`  📤 已委托的带宽: ${delegatedTrx.toFixed(6)} TRX`);
      }

      // 能量委托（可能在类型定义中不存在，使用any访问）
      const accountAny = account;
      if (accountAny.delegated_frozenV2_balance_for_energy) {
        hasStake = true;
        const delegated = accountAny.delegated_frozenV2_balance_for_energy;
        const delegatedTrx = delegated / 1_000_000;
        console.log(`  📤 已委托的能量: ${delegatedTrx.toFixed(6)} TRX`);
      }

      // 从别人接收的委托资源
      if (account.acquired_delegated_frozenV2_balance_for_bandwidth) {
        hasStake = true;
        const acquired = account.acquired_delegated_frozenV2_balance_for_bandwidth;
        const acquiredTrx = acquired / 1_000_000;
        console.log(`  📥 接收的带宽委托: ${acquiredTrx.toFixed(6)} TRX`);
      }

      if (accountAny.acquired_delegated_frozenV2_balance_for_energy) {
        hasStake = true;
        const acquired = accountAny.acquired_delegated_frozenV2_balance_for_energy;
        const acquiredTrx = acquired / 1_000_000;
        console.log(`  📥 接收的能量委托: ${acquiredTrx.toFixed(6)} TRX`);
      }

      if (!hasStake) {
        console.log('  ℹ️  当前无质押记录');
      }
    } catch (error) {
      console.log(`  ❌ 获取质押信息失败: ${error.message}`);
    }
  }

  /**
   * 显示使用说明
   */
  private showUsage(): void {
    console.log('❌ 缺少必需参数');
    console.log('');
    console.log('使用方式:');
    console.log('  npm run console wallet:info -- --address=<地址>');
    console.log('');
    console.log('示例:');
    console.log('  npm run console wallet:info -- --address=TXxx...');
    console.log('');
    console.log('参数说明:');
    console.log('  --address    钱包地址（必需）');
  }

  @Option({
    flags: '-a, --address <address>',
    description: '钱包地址',
  })
  parseAddress(val: string): string {
    return val;
  }
}
