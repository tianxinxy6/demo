import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MerchantEntity } from '@/entities/merchant.entity';
import { RedisService } from '@/shared/cache/redis.service';
import { Status } from '@/constants';
import { getClientIp } from '@/utils';

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
  private readonly TIMESTAMP_WINDOW = 60000; // 时间窗口60秒
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
        this.logger.warn(`Missing authentication headers from IP: ${clientIp}`);
        throw new UnauthorizedException('Missing required authentication headers');
      }

      // 2. 验证时间戳 (提前验证，避免无效请求查询数据库)
      const now = Date.now();
      const requestTime = parseInt(timestamp, 10);

      if (isNaN(requestTime)) {
        this.logger.warn(`Invalid timestamp format from IP: ${clientIp}`);
        throw new UnauthorizedException('Invalid timestamp format');
      }

      const timeDiff = Math.abs(now - requestTime);
      if (timeDiff > this.TIMESTAMP_WINDOW) {
        this.logger.warn(
          `Request timestamp expired from IP: ${clientIp}, time diff: ${timeDiff}ms`,
        );
        throw new UnauthorizedException('Request timestamp expired');
      }

      // 3. 查询API Key（带缓存）
      const merchantEntity = await this.getMerchantWithCache(apiKey);

      if (!merchantEntity) {
        this.logger.warn(`Invalid API Key attempt from IP: ${clientIp}`);
        throw new UnauthorizedException('Invalid API Key');
      }

      // 4. 验证状态
      if (merchantEntity.status !== Status.Enabled) {
        this.logger.warn(`Disabled API Key access attempt: ${apiKey}, IP: ${clientIp}`);
        throw new UnauthorizedException('API Key is disabled');
      }

      // 5. 验证IP白名单
      if (merchantEntity.ipWhitelist && merchantEntity.ipWhitelist.length > 0) {
        if (!merchantEntity.ipWhitelist.includes(clientIp)) {
          this.logger.warn(`IP not whitelisted for API Key: ${apiKey}, IP: ${clientIp}`);
          throw new UnauthorizedException('IP not whitelisted');
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
        this.logger.warn(`Invalid signature for API Key: ${apiKey}, IP: ${clientIp}`);
        throw new UnauthorizedException('Invalid signature');
      }

      // 8. 将API Key信息附加到请求对象
      request.user = {
        uid: merchantEntity.userId,
      };

      return true;
    } catch (error) {
      this.logger.error(`API authentication error from IP: ${clientIp}`, error.stack);
      throw new UnauthorizedException('Authentication failed');
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
