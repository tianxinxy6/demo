import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { TronUtil } from '@/utils/tron.util';

/**
 * 质押命令（Stake 2.0）
 * 使用方式:
 * npm run console freeze:balance -- --trx=100
 * npm run console freeze:balance -- --trx=100 --resource=ENERGY
 */
interface FreezeBalanceOptions {
  trx: number;
  resource?: 'ENERGY' | 'BANDWIDTH';
}

@Injectable()
@Command({
  name: 'freeze:balance',
  description: '质押 TRX 获取能量或带宽',
})
export class FreezeBalanceCommand extends CommandRunner {
  private readonly logger = new Logger(FreezeBalanceCommand.name);

  constructor(
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: FreezeBalanceOptions): Promise<void> {
    try {
      if (!options?.trx) {
        console.log('❌ 缺少必需参数');
        console.log('');
        console.log('使用方式:');
        console.log('  npm run console freeze:balance -- --trx=<TRX数量>');
        console.log('');
        console.log('示例:');
        console.log('  npm run console freeze:balance -- --trx=100');
        console.log('  npm run console freeze:balance -- --trx=100 --resource=ENERGY');
        console.log('');
        console.log('参数说明:');
        console.log('  --trx         质押的TRX数量（必需）');
        console.log('  --resource    资源类型（可选，ENERGY 或 BANDWIDTH，默认为 ENERGY）');
        return;
      }

      const resource = options.resource || 'BANDWIDTH';
      const resourceName = resource === 'ENERGY' ? '能量' : '带宽';
      const trxAmount = options.trx;

      if (trxAmount <= 0) {
        console.error('❌ 质押数量必须大于 0');
        return;
      }

      const rpcUrl = this.configService.get<string>('tron.rpcUrl');
      const privateKey = await this.sysWalletService.getEnergyWallet();
      const tronUtil = new TronUtil(rpcUrl, privateKey);
      const fromAddress = tronUtil.getFromAddress();

      console.log(`\n开始质押 TRX...`);
      console.log(`  账户地址: ${fromAddress}`);
      console.log(`  质押数量: ${trxAmount} TRX`);
      console.log(`  获取资源: ${resourceName}`);
      console.log('');

      // 转换为 SUN（1 TRX = 1,000,000 SUN）
      const sunAmount = Math.floor(trxAmount * 1_000_000);

      const tronWeb = tronUtil.getTronWeb();

      const tx = await tronWeb.transactionBuilder.freezeBalanceV2(sunAmount, resource);

      const signedTx = await tronWeb.trx.sign(tx);
      const result = await tronWeb.trx.sendRawTransaction(signedTx);

      if (result.result) {
        console.log(`✅ 质押成功!`);
        console.log(`  交易哈希: ${result.txid}`);
        console.log(`  查看交易: https://tronscan.org/#/transaction/${result.txid}`);
      } else {
        console.error(`❌ 质押失败: ${result.code || 'Unknown error'}`);
        if (result.message) {
          console.error(`  错误信息: ${TronUtil.parseMessage(result.message)}`);
        }
      }
    } catch (error) {
      this.logger.error(`质押失败: ${error.message}`, error.stack);
      console.error(`\n❌ 错误: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-x, --trx <amount>',
    description: '质押的TRX数量',
  })
  parseTrx(val: string): number {
    return parseFloat(val);
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
