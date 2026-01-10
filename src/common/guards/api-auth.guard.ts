import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MerchantEntity } from '@/entities/merchant.entity';
import { RedisService } from '@/shared/cache/redis.service';
import { Status } from '@/constants';
import { getClientIp } from '@/utils';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants/error-code.constant';

/**
 * API 认证守卫
 * 用于 Merchant API 认证
 *
 * 验证流程:
 * 1. 检查请求头中的 API Key 和签名
 * 2. 验证时间戳 (60秒窗口)
 * 3. 验证 HMAC-SHA256 签名
 * 4. 可选: 验证 IP 白名单
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiAuthGuard.name);
  private readonly TIMESTAMP_WINDOW = 60000; // 时间窗口1分钟
  private readonly CACHE_TTL = 600; // API Key缓存10分钟

  constructor(
    @InjectRepository(MerchantEntity)
    private readonly merchantRepository: Repository<MerchantEntity>,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientIp = getClientIp(request);

    try {
      // 1. 提取认证信息
      const apiKey = request.headers['x-api-key'];
      const timestamp = request.headers['x-timestamp'];
      const signature = request.headers['x-signature'];

      if (!apiKey || !timestamp || !signature) {
        throw new BusinessException(ErrorCode.ErrMerchantSignatureMissing);
      }

      // 2. 验证时间戳 (提前验证，避免无效请求查询数据库)
      const now = Date.now();
      const requestTime = parseInt(timestamp, 10);
      if (isNaN(requestTime)) {
        throw new BusinessException(ErrorCode.ErrTimestampInvalid);
      }

      const timeDiff = Math.abs(now - requestTime);
      if (timeDiff > this.TIMESTAMP_WINDOW) {
        throw new BusinessException(ErrorCode.ErrTimestampInvalid);
      }

      // 3. 查询API Key（带缓存）
      const merchantEntity = await this.getMerchantWithCache(apiKey);
      if (!merchantEntity) {
        throw new BusinessException(ErrorCode.ErrMerchantApiKeyInvalid);
      }

      // 4. 验证状态
      if (merchantEntity.status !== Status.Enabled) {
        throw new BusinessException(ErrorCode.ErrMerchantApiKeyInvalid);
      }

      // 5. 验证IP白名单
      if (merchantEntity.ipWhitelist && merchantEntity.ipWhitelist.length > 0) {
        if (!merchantEntity.ipWhitelist.includes(clientIp)) {
          throw new BusinessException(ErrorCode.ErrMerchantIpNotWhitelisted);
        }
      }

      // 6. 构建签名字符串
      const method = request.method;
      const path = request.route?.path || request.url.split('?')[0];
      const queryString = this.buildQueryString(request.query);
      const bodyString = request.body ? JSON.stringify(request.body) : '';

      const signatureString = [method, path, queryString, bodyString, timestamp].join('\n');

      // 7. 计算并验证 HMAC-SHA256 签名
      const expectedSignature = createHmac('sha256', merchantEntity.secret)
        .update(signatureString)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new BusinessException(ErrorCode.ErrMerchantSignatureInvalid);
      }

      // 8. 将API Key信息附加到请求对象
      request.user = {
        uid: merchantEntity.userId,
      } as IAuthUser;

      return true;
    } catch (error) {
      // 如果已经是 BusinessException，直接抛出
      if (error instanceof BusinessException) {
        throw error;
      }
      // 其他未知错误
      this.logger.error(`API authentication error from IP: ${clientIp}`, error.stack);
      throw new BusinessException(ErrorCode.ErrMerchantApiKeyInvalid);
    }
  }

  /**
   * 带缓存的API Key查询
   */
  private async getMerchantWithCache(apiKey: string): Promise<MerchantEntity | null> {
    const cacheKey = `api:key:${apiKey}`;

    try {
      // 先从缓存获取
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached as MerchantEntity;
      }

      // 缓存未命中，查询数据库
      const apiKeyEntity = await this.merchantRepository.findOne({
        where: { key: apiKey },
        select: ['id', 'userId', 'key', 'secret', 'status', 'ipWhitelist'],
      });

      if (apiKeyEntity) {
        // 只缓存有效的API Key
        await this.redisService.set(cacheKey, apiKeyEntity, {
          ttl: this.CACHE_TTL,
        });
      }

      return apiKeyEntity;
    } catch (error) {
      this.logger.error(`Failed to get API Key: ${apiKey}`, error.stack);
      // 缓存失败时直接查询数据库
      return await this.merchantRepository.findOne({
        where: { key: apiKey },
        select: ['id', 'userId', 'key', 'secret', 'status', 'ipWhitelist'],
      });
    }
  }

  /**
   * 构建查询字符串 (按字母顺序排序)
   */
  private buildQueryString(query: Record<string, any>): string {
    if (!query || Object.keys(query).length === 0) {
      return '';
    }

    const sortedKeys = Object.keys(query).sort();
    const pairs = sortedKeys.map((key) => `${key}=${encodeURIComponent(query[key])}`);
    return pairs.join('&');
  }
}
