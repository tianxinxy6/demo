import { Logger } from '@nestjs/common';

interface TaskInstance {
  telegramAlert?: any;
}

/**
 * 定时任务错误处理装饰器
 * 用于统一处理定时任务中的异常并发送告警
 */
export function CronErrorHandler(taskName?: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const logger = new Logger(target.constructor.name);
    const methodName = String(propertyKey);
    const displayName = taskName || `${target.constructor.name}.${methodName}`;

    descriptor.value = async function (this: TaskInstance, ...args: any[]) {
      try {
        await originalMethod.apply(this, args);
      } catch (error) {
        logger.error(`定时任务执行失败: ${displayName}`, error);

        // 发送 Telegram 告警
        try {
          const telegramAlert = this.telegramAlert;
          if (telegramAlert) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const context: any = {
              taskName: displayName,
              taskClass: target.constructor.name,
              taskMethod: methodName,
            };

            if (error instanceof Error && error.stack) {
              context.stack = error.stack.split('\n').slice(0, 8).join('\n');
            }

            await telegramAlert.sendErrorAlert('定时任务异常', errorMessage, context);
          }
        } catch (alertError) {
          logger.error('发送告警失败', alertError);
        }
      }
    };

    return descriptor;
  };
}
