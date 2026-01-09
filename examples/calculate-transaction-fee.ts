/**
 * TRON 交易费用计算演示
 *
 * 演示如何使用 TronUtil 工具类计算：
 * 1. TRX 转账所需的带宽和手续费
 * 2. TRC20 转账所需的带宽、能量和手续费
 *
 * 运行方式：
 * npm run console -- ts-node examples/calculate-transaction-fee.ts
 */

import { TronUtil } from '../src/utils/tron.util';

// ==================== 配置区 ====================
// const TRON_NODE_URL = 'https://api.trongrid.io'; // TRON 节点 URL
const TRON_NODE_URL = 'https://nile.trongrid.io'; // Nile 测试网

// 示例地址（可以替换为实际地址）
const FROM_ADDRESS = 'TEZsqCWQU4cvjxDJrGYqQMeCqU8NeXdpSg'; // 发送方地址
const TO_ADDRESS = 'TDc1uFKbrWN19hQx5vh2chpHVUH9WTc72F'; // 接收方地址

// USDT TRC20 合约地址（主网）
// const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
// nile USDT 合约地址
const USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

// 转账金额
const TRX_AMOUNT = 10; // 10 TRX（单位：TRX）
const USDT_AMOUNT = 100; // 100 USDT（实际为 100 * 10^6，因为 USDT 有 6 位小数）

// ==================== 主函数 ====================

async function main() {
  console.log('='.repeat(80));
  console.log('TRON 交易费用计算演示');
  console.log('='.repeat(80));
  console.log();

  // 创建 TronUtil 实例（无需私钥，只用于查询）
  const tronUtil = new TronUtil(TRON_NODE_URL);

  // ==================== 1. 计算 TRX 转账费用 ====================
  console.log('📌 1. TRX 转账费用计算');
  console.log('-'.repeat(80));
  await calculateTrxTransferFee(tronUtil);
  console.log();

  // ==================== 2. 计算 TRC20 转账费用 ====================
  console.log('📌 2. TRC20 (USDT) 转账费用计算');
  console.log('-'.repeat(80));
  await calculateTrc20TransferFee(tronUtil);
  console.log();

  // ==================== 3. 查看账户资源情况 ====================
  console.log('📌 3. 账户资源查询');
  console.log('-'.repeat(80));
  await checkAccountResources(tronUtil);
  console.log();

  console.log('='.repeat(80));
  console.log('✅ 演示完成！');
  console.log('='.repeat(80));
}

// ==================== TRX 转账费用计算 ====================
async function calculateTrxTransferFee(tronUtil: TronUtil) {
  try {
    const amountInSun = Number(TronUtil.toSun(TRX_AMOUNT)); // 转换为 SUN

    console.log(`发送方地址: ${FROM_ADDRESS}`);
    console.log(`接收方地址: ${TO_ADDRESS}`);
    console.log(`转账金额: ${TRX_AMOUNT} TRX (${amountInSun} SUN)`);
    console.log();

    // 计算手续费
    const fee = await tronUtil.calculateTrxTransFee(FROM_ADDRESS, TO_ADDRESS, amountInSun);
    const feeInTrx = TronUtil.fromSun(fee);

    console.log(`💰 预估手续费: ${feeInTrx} TRX (${fee} SUN)`);
    console.log();

    // 额外说明
    console.log('📝 说明:');
    console.log('  - TRX 转账固定消耗约 270 Bandwidth');
    console.log('  - 每个账户每天有 1500 免费 Bandwidth');
    console.log('  - 如果 Bandwidth 不足，会燃烧 TRX (1000 SUN/Bandwidth)');
    console.log('  - 激活新账户需要额外 1 TRX');
  } catch (error) {
    console.error('❌ 计算 TRX 转账费用失败:', error.message);
  }
}

// ==================== TRC20 转账费用计算 ====================
async function calculateTrc20TransferFee(tronUtil: TronUtil) {
  try {
    const amountInBase = USDT_AMOUNT * 1_000_000; // USDT 有 6 位小数

    console.log(`发送方地址: ${FROM_ADDRESS}`);
    console.log(`接收方地址: ${TO_ADDRESS}`);
    console.log(`合约地址: ${USDT_CONTRACT}`);
    console.log(`转账金额: ${USDT_AMOUNT} USDT`);
    console.log();

    // 计算手续费
    const gasInfo = await tronUtil.calculateTrc20TransFee(
      FROM_ADDRESS,
      USDT_CONTRACT,
      TO_ADDRESS,
      amountInBase,
    );

    const feeInTrx = TronUtil.fromSun(gasInfo.gas);

    console.log(`💰 预估手续费: ${feeInTrx} TRX (${gasInfo.gas} SUN)`);
    console.log(`  - Bandwidth 不足: ${gasInfo.bandwidthShortage}`);
    console.log(`  - Energy 不足: ${gasInfo.energyShortage}`);
    console.log();

    // 额外说明
    console.log('📝 说明:');
    console.log('  - TRC20 转账固定消耗约 345 Bandwidth');
    console.log('  - TRC20 转账固定消耗约 31,895 Energy (USDT等标准合约)');
    console.log('  - 如果 Bandwidth 不足，燃烧 TRX (1000 SUN/Bandwidth)');
    console.log('  - 如果 Energy 不足，燃烧 TRX (420 SUN/Energy，动态价格)');
    console.log('  - 建议提前租赁能量以降低手续费');
  } catch (error) {
    console.error('❌ 计算 TRC20 转账费用失败:', error.message);
  }
}

// ==================== 查看账户资源 ====================
async function checkAccountResources(tronUtil: TronUtil) {
  try {
    console.log(`查询地址: ${FROM_ADDRESS}`);
    console.log();

    // 获取账户资源
    const resources = await tronUtil.getAccountResource(FROM_ADDRESS);

    console.log(`📊 账户资源情况:`);
    console.log(
      `  - 可用能量: ${resources.energy.toLocaleString()} / ${resources.totalEnergy.toLocaleString()}`,
    );
    console.log(
      `  - 可用带宽: ${resources.bandwidth.toLocaleString()} / ${resources.totalBandwidth.toLocaleString()}`,
    );
    console.log();

    // 计算可执行的 TRC20 转账次数
    const trc20Count = Math.floor(resources.energy / 31895);
    console.log(`💡 资源分析:`);
    console.log(`  - 可执行 TRC20 转账约 ${trc20Count} 次（基于能量）`);

    // 获取 TRX 余额
    const balance = await tronUtil.getTRXBalance(FROM_ADDRESS);
    const balanceInTrx = TronUtil.fromSun(balance);
    console.log(`  - TRX 余额: ${balanceInTrx} TRX`);

    // 获取质押的 TRX
    const staked = await tronUtil.getStakedAmount(FROM_ADDRESS);
    const stakedInTrx = TronUtil.fromSun(staked);
    console.log(`  - 质押 TRX: ${stakedInTrx} TRX`);
  } catch (error) {
    console.error('❌ 查询账户资源失败:', error.message);
  }
}

// ==================== 执行主函数 ====================
main().catch((error) => {
  console.error('程序执行失败:', error);
  process.exit(1);
});
