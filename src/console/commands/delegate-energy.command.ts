import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { TronUtil } from '@/utils/tron.util';

/**
 * 委托能量命令
 * 使用方式:
 * npm run console delegate:energy -- --to=<接收地址> --energy=<能量数量>
 * npm run console delegate:energy -- --to=TXxx... --energy=65000
 * npm run console delegate:energy -- --to=TXxx... --trx=54.17 --lock  # 直接指定TRX数量
 */
interface DelegateEnergyOptions {
  to: string;
  energy?: number; // 能量数量
  trx?: number; // 或直接指定TRX数量
  lock?: boolean;
  resource?: 'ENERGY' | 'BANDWIDTH';
}

@Injectable()
@Command({
  name: 'delegate:energy',
  description: '委托能量给指定地址',
})
export class DelegateEnergyCommand extends CommandRunner {
  private readonly logger = new Logger(DelegateEnergyCommand.name);

  constructor(
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: DelegateEnergyOptions): Promise<void> {
    try {
      // 验证参数
      if (!options?.to || (!options?.energy && !options?.trx)) {
        console.log('❌ 缺少必需参数');
        console.log('');
        console.log('使用方式:');
        console.log('  方式1: 指定能量数量（推荐）');
        console.log('    npm run console delegate:energy -- --to=<接收地址> --energy=<能量数量>');
        console.log('');
        console.log('  方式2: 直接指定TRX数量');
        console.log('    npm run console delegate:energy -- --to=<接收地址> --trx=<TRX数量>');
        console.log('');
        console.log('示例:');
        console.log('  npm run console delegate:energy -- --to=TXxx... --energy=65000');
        console.log('  npm run console delegate:energy -- --to=TXxx... --trx=54.17 --lock');
        console.log(
          '  npm run console delegate:energy -- --to=TXxx... --energy=1000 --resource=BANDWIDTH',
        );
        console.log('');
        console.log('参数说明:');
        console.log('  --to          接收能量的目标地址（必需）');
        console.log('  --energy      委托的能量数量（与 --trx 二选一）');
        console.log('  --trx         质押的TRX数量（与 --energy 二选一）');
        console.log('  --lock        是否锁定委托（可选，默认为 false）');
        console.log('  --resource    资源类型（可选，ENERGY 或 BANDWIDTH，默认为 ENERGY）');
        return;
      }

      // 验证地址格式
      if (!TronUtil.validateAddress(options.to)) {
        console.error(`❌ 无效的 TRON 地址: ${options.to}`);
        return;
      }

      const resource = options.resource || 'ENERGY';
      const resourceName = resource === 'ENERGY' ? '能量' : '带宽';

      // 获取 TRON RPC URL
      const rpcUrl = this.configService.get<string>('tron.rpcUrl');

      // 获取能量钱包的私钥
      // const privateKey = await this.sysWalletService.getEnergyWallet();
      const privateKey = '91acc3b13609d1b6dffe32272bcd0d699107aebdf3812d0e0b66de1c21ff02bb';

      // 创建 TronUtil 实例
      const tronUtil = new TronUtil(rpcUrl, privateKey);

      // 计算需要质押的TRX数量
      let trxAmount: number; // 单位：TRX
      let energyAmount: number; // 能量数量

      if (options.energy) {
        // 方式1: 用户指定能量，系统计算TRX
        energyAmount = options.energy;

        // 获取当前能量转换比例（从链上查询更准确）
        trxAmount = await tronUtil.convertEnergyToTrx(energyAmount);

        console.log(`\n💡 根据能量计算TRX数量:`);
        console.log(`  请求能量: ${energyAmount.toLocaleString()}`);
        console.log(`  需要质押: ${trxAmount} TRX`);
        console.log('');
      } else if (options.trx) {
        // 方式2: 用户直接指定TRX
        trxAmount = options.trx;

        console.log(`\n💡 直接使用指定的TRX数量:`);
        console.log(`  质押TRX: ${trxAmount.toFixed(6)} TRX`);
        console.log('');
      } else {
        console.error(`❌ 必须指定 --energy 或 --trx 参数`);
        return;
      }

      // 验证数量
      if (trxAmount <= 0) {
        console.error(`❌ 质押数量必须大于 0`);
        return;
      }

      console.log(`\n开始委托${resourceName}...`);
      console.log(`  目标地址: ${options.to}`);
      console.log(`  预估${resourceName}: ${energyAmount.toLocaleString()}`);
      console.log(`  锁定状态: ${options.lock ? '是' : '否'}`);
      console.log('');

      // 获取发送方地址
      const fromAddress = tronUtil.getFromAddress();
      console.log(`  发送方地址: ${fromAddress}`);
      console.log('');

      // 委托能量
      console.log(`正在执行委托交易...`);
      const result = await tronUtil.delegateResource(
        options.to,
        trxAmount, // 传入的是TRX数量（SUN单位），必须是整数
        resource,
        options.lock || false,
      );

      if (result.result) {
        console.log(`✅ ${resourceName}委托成功!`);
        console.log(`  交易哈希: ${result.txid}`);
        console.log(`  查看交易: https://tronscan.org/#/transaction/${result.txid}`);
      } else {
        console.error(`❌ 委托失败: ${result.code || 'Unknown error'}`);
        if (result.message) {
          console.error(`  错误信息: ${TronUtil.parseMessage(result.message)}`);
        }
      }
    } catch (error) {
      this.logger.error(`委托能量失败: ${error.message}`, error.stack);
      console.error(`\n❌ 错误: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-t, --to <address>',
    description: '接收能量的目标地址',
  })
  parseTo(val: string): string {
    return val;
  }

  @Option({
    flags: '-e, --energy <amount>',
    description: '委托的能量数量',
  })
  parseEnergy(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: '-x, --trx <amount>',
    description: '质押的TRX数量',
  })
  parseTrx(val: string): number {
    return parseFloat(val);
  }

  @Option({
    flags: '-a, --amount <amount>',
    description: '[已废弃] 请使用 --energy 或 --trx',
  })
  parseAmount(val: string): number {
    console.warn('⚠️  --amount 参数已废弃，请使用 --energy 或 --trx');
    return parseInt(val, 10);
  }

  @Option({
    flags: '-l, --lock',
    description: '是否锁定委托',
  })
  parseLock(): boolean {
    return true;
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
