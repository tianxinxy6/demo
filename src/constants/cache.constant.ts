/**
 * 缓存配置常量
 */
export interface CacheConfig {
  prefix: string;
  ttl: number; // 毫秒
}

/**
 * 统一的缓存配置
 * 所有服务的缓存策略在此定义
 */
export const CacheConfigs = {
  // 用户相关缓存：1小时
  USER: { prefix: 'user:', ttl: 3600000 },

  // 链上代币缓存：1小时
  CHAIN_TOKEN: { prefix: 'chain_token:', ttl: 3600000 },

  // 用户区块链地址缓存：1小时
  CHAIN_ADDRESS: { prefix: 'chain_address:', ttl: 3600000 },

  // 市场价格缓存：1分钟（实时性要求高）
  PRICE: { prefix: 'price:', ttl: 60000 },
} as const;
