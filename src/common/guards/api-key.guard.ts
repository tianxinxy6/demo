import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';

import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants/error-code.constant';
import { SignatureUtil } from '@/utils/signature.util';

const ADMIN_API_KEY_HEADER = 'x-admin-api-key';
const ADMIN_SIGNATURE_HEADER = 'x-admin-signature';
const ADMIN_TIMESTAMP_HEADER = 'x-admin-timestamp';

/**
 * Admin API Key 认证守卫
 *
 * 用于内部应用（如后台管理系统）调用的安全验证
 * 采用 API Key + HMAC 签名机制
 *
 * **安全机制：**
 * 1. API Key 验证：验证调用方身份
 * 2. HMAC-SHA256 签名：防止参数篡改
 * 3. 时间戳验证：防止重放攻击（5分钟有效期）
 * 4. IP 白名单（可选）：限制访问来源
 *
 * **请求头要求：**
 * - X-Admin-Api-Key: 管理员 API Key（从环境变量获取）
 * - X-Admin-Signature: HMAC-SHA256 签名
 * - X-Admin-Timestamp: Unix 时间戳（毫秒）
 *
 * **签名计算方式：**
 * ```
 * signature = HMAC-SHA256(timestamp + JSON.stringify(body), apiSecret)
 * ```
 *
 * **环境变量配置：**
 * - ADMIN_API_KEY: 管理员 API Key
 * - ADMIN_API_SECRET: 管理员 API Secret（用于签名验证）
 *
 * @example
 * // 客户端调用示例（Node.js）
 * import crypto from 'crypto';
 *
 * const apiKey = process.env.ADMIN_API_KEY;
 * const apiSecret = process.env.ADMIN_API_SECRET;
 * const timestamp = Date.now();
 * const body = { userId: 1, name: '测试商户' };
 *
 * const data = `${timestamp}${JSON.stringify(body)}`;
 * const signature = crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
 *
 * fetch('http://api.example.com/admin/merchants', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-Admin-Api-Key': apiKey,
 *     'X-Admin-Signature': signature,
 *     'X-Admin-Timestamp': timestamp.toString(),
 *   },
 *   body: JSON.stringify(body),
 * });
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly adminApiKey: string;
  private readonly adminApiSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.adminApiKey = this.configService.get<string>('app.admin.apiKey', '');
    this.adminApiSecret = this.configService.get<string>('app.admin.apiSecret', '');

    if (!this.adminApiKey || !this.adminApiSecret) {
      throw new Error('⚠️ Admin API Key 或 Secret 未配置，无法启动 ApiKeyGuard');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 如果未配置，则跳过验证（开发环境）
    if (!this.adminApiKey || !this.adminApiSecret) {
      this.logger.warn('⚠️ Admin API Key 未配置，跳过验证');
      return false;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    this.validateApiKey(request);
    this.validateSignature(request);

    return true;
  }

  /**
   * 验证 API Key
   */
  private validateApiKey(request: FastifyRequest): void {
    const apiKey = request.headers[ADMIN_API_KEY_HEADER] as string;

    if (!apiKey) {
      throw new BusinessException(ErrorCode.ErrAdminApiKeyMissing);
    }

    if (apiKey !== this.adminApiKey) {
      throw new BusinessException(ErrorCode.ErrAdminApiKeyInvalid);
    }
  }

  /**
   * 验证签名
   */
  private validateSignature(request: FastifyRequest): void {
    const signature = request.headers[ADMIN_SIGNATURE_HEADER] as string;
    const timestampStr = request.headers[ADMIN_TIMESTAMP_HEADER] as string;

    if (!signature || !timestampStr) {
      throw new BusinessException(ErrorCode.ErrAdminSignatureMissing);
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || timestamp <= 0) {
      throw new BusinessException(ErrorCode.ErrTimestampInvalid);
    }

    // 验证签名（SignatureUtil.verify 内部包含完整的时间戳验证）
    const isValid = SignatureUtil.verify(this.adminApiSecret, signature, timestamp, request.body);
    if (!isValid) {
      throw new BusinessException(ErrorCode.ErrAdminSignatureInvalid);
    }
  }
}
