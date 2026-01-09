/**
 * Admin API 测试脚本
 *
 * 使用方法：
 * 1. 配置环境变量：ADMIN_API_KEY, ADMIN_API_SECRET
 * 2. 运行: node test-admin-api.js
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

class AdminApiClient {
  constructor(apiKey, apiSecret, baseUrl) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  /**
   * 生成签名
   */
  generateSignature(timestamp, body) {
    const data = `${timestamp}${JSON.stringify(body)}`;
    return crypto.createHmac('sha256', this.apiSecret).update(data).digest('hex');
  }

  /**
   * 发送 HTTP 请求
   */
  async request(method, path, body) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const signature = this.generateSignature(timestamp, body);

      const url = new URL(`${this.baseUrl}${path}`);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Api-Key': this.apiKey,
          'X-Admin-Signature': signature,
          'X-Admin-Timestamp': timestamp.toString(),
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
            if (response.code === 0) {
              resolve(response);
            } else {
              reject(new Error(`API Error (code: ${response.code}): ${response.message}`));
            }
          } catch (error) {
            reject(new Error(`Parse Error: ${error.message}\n${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request Error: ${error.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * 创建商户
   */
  async createMerchant(name) {
    const body = { name };
    return this.request('POST', '/v1/admin/merchant', body);
  }
}

// 测试函数
async function testCreateMerchant() {
  const apiKey = process.env.ADMIN_API_KEY;
  const apiSecret = process.env.ADMIN_API_SECRET;
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';

  if (!apiKey || !apiSecret) {
    console.error('❌ 请配置环境变量: ADMIN_API_KEY 和 ADMIN_API_SECRET');
    process.exit(1);
  }

  console.log('🚀 Admin API 测试开始...\n');

  const client = new AdminApiClient(apiKey, apiSecret, baseUrl);

  try {
    console.log('📝 测试：创建商户');
    const merchantName = `测试商户_${Date.now()}`;
    const result = await client.createMerchant(merchantName);

    console.log('✅ 创建成功!');
    console.log('商户名称:', merchantName);
    console.log('\n⚠️  注意：请妥善保存 API Secret，系统不会再次显示！');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testCreateMerchant()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
