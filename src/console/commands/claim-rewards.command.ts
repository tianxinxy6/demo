import { Command, CommandRunner } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { TronUtil } from '@/utils/tron.util';

/**
 * 领取投票奖励命令
 * 使用方式:
 * npm run console claim:rewards
 */
@Injectable()
@Command({
  name: 'claim:rewards',
  description: '领取投票奖励',
})
export class ClaimRewardsCommand extends CommandRunner {
  private readonly logger = new Logger(ClaimRewardsCommand.name);

  constructor(
    private readonly sysWalletService: SysWalletAddressService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(): Promise<void> {
    try {
      const rpcUrl = this.configService.get<string>('tron.rpcUrl');
      const privateKey = await this.sysWalletService.getEnergyWallet();
      const tronUtil = new TronUtil(rpcUrl, privateKey);
      const fromAddress = tronUtil.getFromAddress();

      console.log('');
      console.log('🎁 开始领取投票奖励...');
      console.log(`  账户地址: ${fromAddress}`);
      console.log('');

      // 获取账户信息
      const tronWeb = tronUtil.getTronWeb();

      // 查询可领取的奖励
      console.log('💰 正在查询可领取的奖励...');
      const account = await tronWeb.trx.getAccount(fromAddress);

      // 检查是否有投票
      if (!account.votes || account.votes.length === 0) {
        console.log('  ⚠️  当前账户没有投票记录');
        console.log('');
        console.log('💡 提示：需要先投票才能获得奖励');
        console.log('   使用命令: npm run console vote:witness -- --address=<SR地址>');
        return;
      }

      console.log(`  ✅ 发现 ${account.votes.length} 个投票记录`);

      // 显示投票信息
      console.log('');
      console.log('  📊 当前投票情况:');
      for (const vote of account.votes) {
        const voteAddress = TronUtil.hexToAddress(vote.vote_address);
        const voteCount = vote.vote_count || 0;
        console.log(`     - ${voteAddress}: ${voteCount} 票`);
      }
      console.log('');

      // 查询可领取奖励金额
      try {
        const reward = await tronWeb.trx.getReward(fromAddress as string);
        const rewardTrx = reward / 1_000_000;

        if (reward === 0 || rewardTrx === 0) {
          console.log('  ℹ️  当前没有可领取的奖励');
          console.log('');
          console.log('💡 提示：投票奖励每个维护周期（6小时）结算一次');
          console.log('   请在下个维护周期后再来领取');
          return;
        }

        console.log(`  💎 可领取奖励: ${rewardTrx.toFixed(6)} TRX (${reward} SUN)`);
        console.log('');

        // 领取奖励
        console.log('⏳ 正在提交领取奖励交易...');
        const transaction = await tronWeb.transactionBuilder.withdrawBlockRewards(
          fromAddress as string,
        );

        // 签名交易
        const signedTx = await tronWeb.trx.sign(transaction);

        // 广播交易
        const result = await tronWeb.trx.sendRawTransaction(signedTx);

        if (result.result || String(result.code) === 'SUCCESS') {
          console.log('✅ 领取成功!');
          console.log(`  交易哈希: ${result.txid || result.transaction?.txID}`);
          console.log(
            `  查看交易: https://tronscan.org/#/transaction/${result.txid || result.transaction?.txID}`,
          );
          console.log(`  领取金额: ${rewardTrx.toFixed(6)} TRX`);
          console.log('');
          console.log('💡 提示：奖励已发放到您的账户余额');
        } else {
          console.error('❌ 领取失败');
          if (result.message) {
            console.error(`  错误信息: ${TronUtil.parseMessage(result.message)}`);
          }
          if (result.code) {
            console.error(`  错误代码: ${result.code}`);
          }
        }
      } catch (error) {
        if (error.message?.includes('Reward is not ready to withdraw')) {
          console.log('  ℹ️  奖励尚未准备好领取');
          console.log('');
          console.log('💡 提示：投票奖励每个维护周期（6小时）结算一次');
          console.log('   请在下个维护周期后再来领取');
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('');
      console.error('❌ 领取奖励失败:', error.message);
      this.logger.error('领取奖励失败', error.stack);
    }
  }
}
