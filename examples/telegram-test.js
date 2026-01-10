/**
 * Telegram 告警功能独立测试脚本
 *
 * 直接测试 Telegram Bot 配置，不依赖 NestJS 应用
 *
 * 使用方法：
 * node examples/simple-telegram-test.js
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');

async function testTelegram() {
  console.log('🚀 开始测试 Telegram 配置...\n');

  // 读取环境变量
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  const enabled = process.env.TELEGRAM_ALERT_ENABLED === 'true';

  console.log('📋 当前配置：');
  console.log(`   TELEGRAM_ALERT_ENABLED: ${enabled}`);
  console.log(`   TELEGRAM_BOT_TOKEN: ${botToken ? botToken.substring(0, 10) + '...' : '未配置'}`);
  console.log(`   TELEGRAM_ALERT_CHAT_ID: ${chatId || '未配置'}`);
  console.log('');

  // 检查配置
  if (!enabled) {
    console.log('⚠️  告警功能未启用');
    console.log('   请在 .env 文件中设置: TELEGRAM_ALERT_ENABLED=true\n');
    return;
  }

  if (!botToken) {
    console.log('❌ Bot Token 未配置');
    console.log('   请在 .env 文件中设置: TELEGRAM_BOT_TOKEN=your_token\n');
    return;
  }

  if (!chatId) {
    console.log('❌ Chat ID 未配置');
    console.log('   请在 .env 文件中设置: TELEGRAM_ALERT_CHAT_ID=your_chat_id\n');
    return;
  }

  try {
    console.log('🔄 初始化 Telegram Bot...');
    const bot = new Telegraf(botToken);

    // 测试 Bot 连接
    console.log('🔄 测试 Bot 连接...');
    const botInfo = await bot.telegram.getMe();
    console.log(`✅ Bot 连接成功: @${botInfo.username}\n`);

    // 发送测试消息
    console.log('📤 发送测试消息...');
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const message = `🚨 <b>系统错误</b>

<b>测试：Telegram 告警功能</b>

💬 这是一条测试消息，用于验证 Telegram 告警配置是否正确

📊 <b>详情:</b>
<pre>{
  "testType": "DEMO",
  "timestamp": "${new Date().toISOString()}",
  "environment": "${process.env.NODE_ENV || 'development'}",
  "status": "测试成功"
}</pre>

🕐 ${timestamp}`;

    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });

    console.log('✅ 测试消息发送成功！');
    console.log('📱 请检查你的 Telegram 是否收到消息\n');
    console.log('🎉 所有测试通过！Telegram 告警功能配置正确。\n');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('\n可能的原因：');
    console.error('1. Bot Token 不正确');
    console.error('2. Chat ID 不正确或 Bot 未启动对话');
    console.error('3. 网络连接问题');
    console.error('\n调试建议：');
    console.error('• 确认 Bot Token 来自 @BotFather');
    console.error('• 确认已在 Telegram 中向 Bot 发送过 /start');
    console.error(
      '• 访问 https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates 获取正确的 Chat ID\n',
    );
  }
}

testTelegram().catch(console.error);
