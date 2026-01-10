import * as crypto from 'crypto';

/**
 * 签名工具类
 *
 * **签名规则：** HMAC-SHA256(timestamp + JSON.stringify(body), secret)
 *
 * **安全机制：**
 * - 时间戳验证：防止过期请求（5分钟）
 * - 签名验证：防止参数篡改
 * - 配合幂等性拦截器：防止重复提交
 */
export class SignatureUtil {
  /**
   * 生成签名
   */
  static generate(
    secret: string,
    body: any = {},
  ): {
    signature: string;
    timestamp: number;
  } {
    const timestamp = Date.now();
    const data = `${timestamp}${JSON.stringify(body)}`;
    const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    return { signature, timestamp };
  }

  /**
   * 验证签名
   */
  static verify(
    secret: string,
    signature: string,
    timestamp: number,
    body: any = {},
    tolerance: number = 60 * 1000, // 1分钟
  ): boolean {
    const now = Date.now();

    // 拒绝未来时间戳（允许30秒时钟偏差）
    if (timestamp > now + 30000) {
      return false;
    }

    // 验证时间戳在容忍范围内（必须是过去的时间）
    const timeDiff = now - timestamp;
    if (timeDiff < 0 || timeDiff > tolerance) {
      return false;
    }

    // 计算签名
    const data = `${timestamp}${JSON.stringify(body)}`;
    const computedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    // 检查签名长度是否匹配（防止 timingSafeEqual 抛出异常）
    if (signature.length !== computedSignature.length) {
      return false;
    }

    // 安全比较（防止时序攻击）
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
    } catch (error) {
      return false;
    }
  }
}
