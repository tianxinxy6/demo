/**
 * Merchant API 测试脚本
 *
 * 使用方法：
 * node examples/test-merchant-api.js
 *
 * 商户信息:
 * - API Key: mk_93d81cecf975929284c50ba0fc72acc1
 * - API Secret: 7e4e047a49167e4c5772a5e29e14f9a2f0da90965d407ed16eebce4832961084
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

class MerchantApiClient {
  constructor(apiKey, apiSecret, baseUrl) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  /**
   * 生成签名
   * 算法：HMAC-SHA256(METHOD\nPATH\nQUERY_STRING\nBODY\nTIMESTAMP)
   */
  generateSignature(method, path, queryString, body, timestamp) {
    const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
    const signatureString = [method, path, queryString, bodyString, timestamp].join('\n');
    return crypto.createHmac('sha256', this.apiSecret).update(signatureString).digest('hex');
  }

  /**
   * 构建查询字符串 (按字母顺序排序)
   */
  buildQueryString(query) {
    if (!query || Object.keys(query).length === 0) {
      return '';
    }
    const sortedKeys = Object.keys(query).sort();
    const pairs = sortedKeys.map((key) => `${key}=${encodeURIComponent(query[key])}`);
    return pairs.join('&');
  }

  /**
   * 发送 HTTP 请求
   */
  async request(method, path, body = {}, query = {}) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const queryString = this.buildQueryString(query);

      const url = new URL(`${this.baseUrl}${path}`);
      // 使用完整的路径（包含 /api 前缀）来生成签名
      const fullPath = url.pathname;
      const signature = this.generateSignature(method, fullPath, queryString, body, timestamp);

      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (queryString ? `?${queryString}` : ''),
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
          'X-TIMESTAMP': timestamp.toString(),
          'X-SIGNATURE': signature,
        },
      };

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log(`📥 响应状态码: ${res.statusCode}`);

            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve(response);
            } else {
              reject(new Error(`API Error (${res.statusCode}): ${JSON.stringify(response)}`));
            }
          } catch (error) {
            reject(new Error(`Parse Error: ${error.message}\n${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request Error: ${error.message}`));
      });

      if (method !== 'GET' && body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * 租赁能量
   */
  async rentEnergy(receiverAddress, energyAmount, minutes) {
    const body = {
      receiverAddress,
      energyAmount,
      minutes,
    };
    return this.request('POST', '/v1/merchant/energy/rent', body, {});
  }

  /**
   * 查询商户钱包余额
   */
  async getWallet() {
    return this.request('GET', '/v1/merchant/wallet', {}, {});
  }

  /**
   * 查询平台可租赁能量
   */
  async getPlatformEnergy() {
    return this.request('GET', '/v1/merchant/platform/energy', {}, {});
  }
}

// 测试函数
async function runTests() {
  // 商户信息
  const apiKey = 'mk_93d81cecf975929284c50ba0fc72acc1';
  const apiSecret = '7e4e047a49167e4c5772a5e29e14f9a2f0da90965d407ed16eebce4832961084';
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';

  console.log('🚀 Merchant API 测试开始...\n');
  console.log('📌 配置信息:');
  console.log(`   API Base URL: ${baseUrl}`);
  console.log(`   API Key: ${apiKey}`);
  console.log(`   API Secret: ${apiSecret.substring(0, 20)}...`);
  console.log('');

  const client = new MerchantApiClient(apiKey, apiSecret, baseUrl);

  try {
    // 测试1: 查询商户钱包余额
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 测试1: 查询商户钱包余额');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const wallet = await client.getWallet();
    console.log('✅ 查询成功!');
    console.log('💰 钱包余额:');
    if (wallet.data && Array.isArray(wallet.data)) {
      wallet.data.forEach((w) => {
        console.log(`   ${w.token.code}:`);
        console.log(`     - 可用余额: ${w.balance}`);
        console.log(`     - 冻结余额: ${w.frozenBalance}`);
        console.log(`     - 总余额: ${w.totalBalance}`);
      });
    } else {
      console.log(JSON.stringify(wallet, null, 2));
    }
    console.log('');

    // 测试2: 查询平台可租赁能量
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 测试2: 查询平台可租赁能量');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const platformEnergy = await client.getPlatformEnergy();
    console.log('✅ 查询成功!');
    console.log(`⚡ 平台可用能量: ${JSON.stringify(platformEnergy.data || platformEnergy)}`);
    console.log('');

    // 测试3: 租赁能量（需要有效的接收地址）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 测试3: 租赁能量');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 使用测试地址 (请替换为实际的测试地址)
    const testAddress = 'TS58AeyQCMFQHVhMCx4a5qzBTUCNnBubaB';
    const energyAmount = 65000; // 最小租赁量
    const minutes = 10; // 10分钟

    console.log(`   接收地址: ${testAddress}`);
    console.log(`   能量数量: ${energyAmount}`);
    console.log(`   租赁时长: ${minutes} 分钟`);

    try {
      const rentResult = await client.rentEnergy(testAddress, energyAmount, minutes);
      console.log('✅ 租赁成功!');
      console.log('📋 订单详情:');
      console.log(JSON.stringify(rentResult.data || rentResult, null, 2));
    } catch (error) {
      console.log('⚠️  租赁失败 (这可能是正常的，取决于钱包余额和平台状态):');
      console.log(`   错误信息: ${error.message}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

// 运行测试
runTests()
  .then(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有测试完成');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
