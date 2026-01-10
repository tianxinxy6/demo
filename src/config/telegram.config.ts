import { registerAs } from '@nestjs/config';
import { env, envBoolean } from '@/global/env';

export default registerAs('telegram', () => ({
  botToken: env('TELEGRAM_BOT_TOKEN', ''),
  webhook: env('TELEGRAM_WEBHOOK', ''),
  alertEnabled: envBoolean('TELEGRAM_ALERT_ENABLED', false),
  alertChatId: env('TELEGRAM_ALERT_CHAT_ID', ''),
}));
