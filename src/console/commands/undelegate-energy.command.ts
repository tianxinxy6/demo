import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { AppConfigService } from '@/shared/services/config.service';
import { TronUtil } from '@/utils/tron.util';

/**
 * 取消委托能量命令
 * 使用方式:
 * npm run console undelegate:energy -- --from=<接收地址>
 * npm run console undelegate:energy -- --from=TXxx...
 *
 * 注意：会自动回收委托给该地址的所有能量
 */
interface UndelegateEnergyOptions {
  from: string;
  resource?: 'ENERGY' | 'BANDWIDTH';
}

@Injectable()
@Command({
  name: 'undelegate:energy',
  description: '取消委托能量',
})
export class UndelegateEnergyCommand extends CommandRunner {
  private readonly logger = new Logger(UndelegateEnergyCommand.name);

  constructor(
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: UndelegateEnergyOptions): Promise<void> {
    try {
      // 验证参数
      if (!options?.from) {
        console.log('❌ 缺少必需参数');
        console.log('');
        console.log('使用方式:');
        console.log('  npm run console undelegate:energy -- --from=<接收地址>');
        console.log('');
        console.log('示例:');
        console.log('  npm run console undelegate:energy -- --from=TXxx...');
        console.log('  npm run console undelegate:energy -- --from=TXxx... --resource=BANDWIDTH');
        console.log('');
        console.log('参数说明:');
        console.log('  --from        接收能量的地址（必需）');
        console.log('  --resource    资源类型（可选，ENERGY 或 BANDWIDTH，默认为 ENERGY）');
        console.log('');
        console.log('注意：此命令会回收委托给该地址的所有能量');
        return;
      }

      // 验证地址格式
      if (!TronUtil.validateAddress(options.from)) {
        console.error(`❌ 无效的 TRON 地址: ${options.from}`);
        return;
      }

      const resource = options.resource || 'ENERGY';
      const resourceName = resource === 'ENERGY' ? '能量' : '带宽';

      // 获取 TRON RPC URL
      const rpcUrl = this.configService.get<string>('tron.rpcUrl');

      // 获取能量钱包的私钥
      const privateKey = await this.sysWalletService.getEnergyWallet();

      // 创建 TronUtil 实例
      const tronUtil = new TronUtil(rpcUrl, privateKey);

      // 获取能量所有者地址
      const ownerAddress = await this.appConfigService.getEnergyOwnerWallet();
      if (!ownerAddress) {
        throw new Error('系统能量钱包地址未配置');
      }

      // 获取当前操作账户地址
      const fromAddress = tronUtil.getFromAddress();
      console.log(`\n正在查询委托信息...`);
      console.log(`  当前账户: ${fromAddress}`);
      console.log(`  资源所有者: ${ownerAddress}`);
      console.log(`  接收方: ${options.from}`);
      console.log('');

      // 查询委托给该地址的资源数量
      const delegatedAmount = await tronUtil.getDelegatedAmount(
        options.from,
        resource,
        ownerAddress,
      );

      if (delegatedAmount === 0) {
        console.log(`⚠️  未找到委托给地址 ${options.from} 的${resourceName}`);
        console.log('   可能原因：');
        console.log('   1. 从未委托给该地址');
        console.log('   2. 之前的委托已经到期并回收');
        return;
      }

      console.log(`📊 委托信息:`);
      console.log(
        `  ${resourceName}数量: ${delegatedAmount.toLocaleString()} SUN (${(delegatedAmount / 1_000_000).toFixed(6)} TRX)`,
      );
      console.log('');

      // 取消委托能量
      console.log(`正在执行取消委托交易...`);

      const result = await tronUtil.undelegateResourceWithPermission(
        ownerAddress,
        options.from,
        delegatedAmount,
        resource,
      );

      if (result.result) {
        console.log(`✅ 取消${resourceName}委托成功!`);
        console.log(`  交易哈希: ${result.txid}`);
        console.log(`  查看交易: https://tronscan.org/#/transaction/${result.txid}`);
      } else {
        console.error(`❌ 取消委托失败: ${result.code || 'Unknown error'}`);
        if (result.message) {
          console.error(`  错误信息: ${result.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`取消委托能量失败: ${error.message}`, error.stack);
      console.error(`\n❌ 错误: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-f, --from <address>',
    description: '接收能量的地址',
  })
  parseFrom(val: string): string {
    return val;
  }

  @Option({
    flags: '-r, --resource <type>',
    description: '资源类型（ENERGY 或 BANDWIDTH）',
  })
  parseResource(val: string): 'ENERGY' | 'BANDWIDTH' {
    const upper = val.toUpperCase();
    if (upper !== 'ENERGY' && upper !== 'BANDWIDTH') {
      throw new Error('资源类型只能是 ENERGY 或 BANDWIDTH');
    }
    return upper;
  }
}
