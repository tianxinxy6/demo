import { registerAs } from '@nestjs/config';
import { env } from '@/global/env';

export default registerAs('tron', () => ({
  // 主网配置
  rpcUrl: env('TRON_RPC_URL', 'https://api.trongrid.io'),

  // API Key（TronGrid）
  key: env('TRON_API_KEY', ''),
}));
