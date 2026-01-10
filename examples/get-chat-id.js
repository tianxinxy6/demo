/**
 * 获取 Telegram Chat ID 的辅助脚本
 *
 * 使用步骤：
 * 1. 在 .env 文件中配置 TELEGRAM_BOT_TOKEN
 * 2. 在 Telegram 中搜索你的 Bot（通过用户名）
 * 3. 向 Bot 发送任意消息（例如：/start 或 hello）
 * 4. 运行此脚本：node examples/get-chat-id.js
 *
 * 脚本会显示所有与 Bot 交互过的 Chat ID
 */

require('dotenv').config();
const https = require('https');

async function getChatId() {
  console.log('🔍 开始获取 Telegram Chat ID...\n');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.log('❌ 未找到 Bot Token');
    console.log('   请在 .env 文件中设置: TELEGRAM_BOT_TOKEN=your_token\n');
    console.log('💡 如何获取 Bot Token：');
    console.log('   1. 在 Telegram 中搜索 @BotFather');
    console.log('   2. 发送 /newbot 创建新机器人');
    console.log('   3. 按提示设置机器人名称和用户名');
    console.log('   4. 获取 Bot Token 并保存到 .env 文件\n');
    return;
  }

  console.log(`✅ Bot Token: ${botToken.substring(0, 10)}...\n`);
  console.log('🔄 正在获取更新消息...\n');

  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (!response.ok) {
              console.log('❌ API 请求失败:', response.description);
              console.log('\n可能的原因：');
              console.log('• Bot Token 不正确');
              console.log('• Token 格式错误\n');
              return;
            }

            const updates = response.result;

            if (updates.length === 0) {
              console.log('⚠️  没有找到任何消息');
              console.log('\n📝 请按以下步骤操作：');
              console.log('   1. 在 Telegram 中搜索你的 Bot（通过用户名 @your_bot_username）');
              console.log('   2. 点击 "START" 或发送任意消息（如：/start 或 hello）');
              console.log('   3. 再次运行此脚本\n');
              console.log('💡 提示：如果是群组，需要先将 Bot 添加到群组并发送消息\n');
              return;
            }

            console.log(`✅ 找到 ${updates.length} 条消息\n`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // 收集所有唯一的 Chat ID
            const chatMap = new Map();

            updates.forEach((update) => {
              const message = update.message || update.edited_message || update.channel_post;
              if (message && message.chat) {
                const chat = message.chat;
                const chatId = chat.id;

                if (!chatMap.has(chatId)) {
                  chatMap.set(chatId, {
                    id: chatId,
                    type: chat.type,
                    title: chat.title,
                    username: chat.username,
                    firstName: chat.first_name,
                    lastName: chat.last_name,
                  });
                }
              }
            });

            let index = 1;
            chatMap.forEach((chat) => {
              console.log(`\n📱 Chat ${index}:`);
              console.log(`   Chat ID: ${chat.id}`);
              console.log(`   类型: ${chat.type}`);

              if (chat.type === 'private') {
                console.log(
                  `   名称: ${[chat.firstName, chat.lastName].filter(Boolean).join(' ')}`,
                );
                if (chat.username) {
                  console.log(`   用户名: @${chat.username}`);
                }
              } else if (chat.type === 'group' || chat.type === 'supergroup') {
                console.log(`   群组名称: ${chat.title}`);
                if (chat.username) {
                  console.log(`   群组用户名: @${chat.username}`);
                }
              } else if (chat.type === 'channel') {
                console.log(`   频道名称: ${chat.title}`);
                if (chat.username) {
                  console.log(`   频道用户名: @${chat.username}`);
                }
              }

              index++;
            });

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('\n✅ 完成！请将上面的 Chat ID 复制到 .env 文件中：');
            console.log('   TELEGRAM_ALERT_CHAT_ID=your_chat_id\n');
            console.log('💡 提示：');
            console.log('   • 个人聊天：使用正数的 Chat ID');
            console.log('   • 群组/频道：使用负数的 Chat ID\n');

            resolve();
          } catch (error) {
            console.error('❌ 解析响应失败:', error.message);
            reject(error);
          }
        });
      })
      .on('error', (error) => {
        console.error('❌ 网络请求失败:', error.message);
        reject(error);
      });
  });
}

getChatId().catch(console.error);
