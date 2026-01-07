import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 当前用户装饰器
 *
 * 从请求对象中提取用户信息
 * 需要配合 ApiAuthGuard 使用
 *
 * @example
 * ```ts
 * @Get()
 * async getProfile(@CurrentUser('userId') userId: number) {
 *   // userId 已自动提取
 * }
 *
 * @Post()
 * async create(@CurrentUser() user: { userId: number; apiKey: string }) {
 *   // 获取完整用户对象
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // 如果指定了字段名，返回该字段
    if (data) {
      return user?.[data];
    }

    // 否则返回完整用户对象
    return user;
  },
);
