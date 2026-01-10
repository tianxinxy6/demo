import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

/**
 * Telegram 告警服务
 * 用于发送系统错误告警到 Telegram
 */
@Injectable()
export class TelegramAlertService implements OnModuleInit {
  private readonly logger = new Logger(TelegramAlertService.name);
  private bot: Telegraf | null = null;
  private chatId: string;
  private enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const botToken = this.configService.get<string>('telegram.botToken');
    this.chatId = this.configService.get<string>('telegram.alertChatId', '');
    this.enabled = this.configService.get<boolean>('telegram.alertEnabled', false);

    if (this.enabled && botToken && this.chatId) {
      try {
        this.bot = new Telegraf(botToken);
        this.logger.log('✅ Telegram 告警服务已初始化');
      } catch (error) {
        this.logger.error('❌ Telegram Bot 初始化失败', error);
        this.enabled = false;
      }
    }
  }

  async onModuleInit() {
    if (this.enabled && this.bot) {
      try {
        const botInfo = await this.bot.telegram.getMe();
        this.logger.log(`✅ Telegram Bot 连接成功: @${botInfo.username}`);
      } catch (error) {
        this.logger.error('❌ Telegram Bot 连接失败', error);
        this.enabled = false;
      }
    }
  }

  /**
   * 发送错误告警
   */
  async sendErrorAlert(title: string, message: string, context?: any): Promise<void> {
    if (!this.enabled || !this.bot) {
      return;
    }

    try {
      const text = this.formatMessage(title, message, context);
      await this.bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error('发送 Telegram 告警失败', error);
    }
  }

  /**
   * 格式化消息
   */
  private formatMessage(title: string, message: string, context?: any): string {
    let text = `🚨 <b>系统错误</b>\n\n`;
    text += `<b>${this.escapeHtml(title)}</b>\n\n`;
    text += `💬 ${this.escapeHtml(message)}\n`;

    if (context) {
      text += `\n📊 <b>详情:</b>\n`;
      text += `<pre>${this.escapeHtml(JSON.stringify(context, null, 2))}</pre>\n`;
    }

    text += `\n🕐 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    // Telegram 消息长度限制
    if (text.length > 4000) {
      text = text.substring(0, 3900) + '\n\n... (消息过长，已截断)';
    }

    return text;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
