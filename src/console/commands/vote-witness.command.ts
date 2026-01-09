import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { TronUtil } from '@/utils/tron.util';

/**
 * 投票命令
 * 使用方式:
 * npm run console vote:witness -- --address=TXxx...
 * npm run console vote:witness -- --address=TXxx... --amount=10
 */
interface VoteWitnessOptions {
  address: string;
  amount?: number;
}

@Injectable()
@Command({
  name: 'vote:witness',
  description: '投票给指定的超级代表',
})
export class VoteWitnessCommand extends CommandRunner {
  private readonly logger = new Logger(VoteWitnessCommand.name);

  constructor(
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: VoteWitnessOptions): Promise<void> {
    try {
      // 验证参数
      if (!options?.address) {
        this.showUsage();
        return;
      }

      // 验证地址格式
      if (!TronUtil.validateAddress(options.address)) {
        console.error(`❌ 无效的超级代表地址: ${options.address}`);
        return;
      }

      const rpcUrl = this.configService.get<string>('tron.rpcUrl');
      const privateKey = await this.sysWalletService.getEnergyWallet();
      const tronUtil = new TronUtil(rpcUrl, privateKey);
      const fromAddress = tronUtil.getFromAddress();

      console.log('');
      console.log('🗳️  开始投票流程...');
      console.log(`  账户地址: ${fromAddress}`);
      console.log('');

      // 获取账户信息
      const tronWeb = tronUtil.getTronWeb();
      const accountResources = await tronWeb.trx.getAccountResources(fromAddress);

      // 检查投票权
      const voteLimit = accountResources.tronPowerLimit || 0;
      const voteUsed = accountResources.tronPowerUsed || 0;
      const tronPower = voteLimit;

      if (tronPower === 0) {
        console.error('❌ 账户没有可用的投票权（TRON Power）');
        console.log('');
        console.log('💡 提示：需要先质押 TRX 获取投票权');
        console.log('   使用命令: npm run console freeze:balance -- --trx=<数量>');
        return;
      }

      // 如果指定了投票数量，使用指定数量，否则使用全部投票权
      const voteAmount = options?.amount || tronPower;

      if (voteAmount > tronPower) {
        console.error(`❌ 投票数量 ${voteAmount} 超过可用投票权 ${tronPower}`);
        return;
      }

      console.log(`  可用投票权: ${tronPower} TP`);
      console.log(`  本次投票数: ${voteAmount} TP`);
      console.log(`  投票地址: ${options.address}`);
      console.log('');

      // 执行投票
      await this.voteForWitness(tronWeb, options.address, voteAmount);
    } catch (error) {
      console.error('');
      console.error('❌ 投票失败:', error.message);
      this.logger.error('投票失败', error.stack);
    }
  }

  /**
   * 执行投票操作
   */
  private async voteForWitness(
    tronWeb: any,
    witnessAddress: string,
    amount: number,
  ): Promise<void> {
    try {
      console.log('⏳ 正在提交投票交易...');

      // 创建投票交易
      const votes = {};
      votes[witnessAddress] = Math.floor(amount);

      const transaction = await tronWeb.transactionBuilder.vote(
        votes,
        tronWeb.defaultAddress.base58,
      );

      // 签名交易
      const signedTx = await tronWeb.trx.sign(transaction);

      // 广播交易
      const result = await tronWeb.trx.sendRawTransaction(signedTx);

      if (result.result || result.code === 'SUCCESS') {
        console.log('✅ 投票成功!');
        console.log(`  交易哈希: ${result.txid || result.transaction?.txID}`);
        console.log(
          `  查看交易: https://tronscan.org/#/transaction/${result.txid || result.transaction?.txID}`,
        );
        console.log('');
        console.log('💡 提示：投票后需要等待下一个维护周期才能获得收益');
      } else {
        console.error('❌ 投票失败');
        if (result.message) {
          console.error(`  错误信息: ${TronUtil.parseMessage(result.message)}`);
        }
        if (result.code) {
          console.error(`  错误代码: ${result.code}`);
        }
      }
    } catch (error) {
      throw new Error(`投票交易失败: ${error.message}`);
    }
  }

  /**
   * 显示使用说明
   */
  private showUsage(): void {
    console.log('❌ 缺少必需参数');
    console.log('');
    console.log('使用方式:');
    console.log('  npm run console vote:witness -- --address=<超级代表地址>');
    console.log('');
    console.log('示例:');
    console.log('  npm run console vote:witness -- --address=T9zs7JkNC2gwWNmawak5UgSqXHBwXEW9kd');
    console.log(
      '  npm run console vote:witness -- --address=T9zs7JkNC2gwWNmawak5UgSqXHBwXEW9kd --amount=10',
    );
    console.log('');
    console.log('参数说明:');
    console.log('  --address    超级代表地址（必需）');
    console.log('  --amount     投票数量（可选，默认使用全部投票权）');
  }

  @Option({
    flags: '-a, --address <address>',
    description: '超级代表地址',
  })
  parseAddress(val: string): string {
    return val;
  }

  @Option({
    flags: '-m, --amount <amount>',
    description: '投票数量（可选，默认使用全部投票权）',
  })
  parseAmount(val: string): number {
    return parseFloat(val);
  }
}
