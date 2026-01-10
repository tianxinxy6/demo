import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '@/common/exceptions/biz.exception';
import { TelegramAlertService } from '@/shared/services/telegram-alert.service';

import { isDev } from '@/global/env';

interface MyError {
  readonly status: number;
  readonly statusCode?: number;
  readonly message?: string;
}

/**
 * 全局异常过滤器
 * 职责：
 * 1. 捕获所有未处理的异常
 * 2. 统一异常响应格式
 * 3. 区分业务异常和系统异常
 * 4. 生产环境隐藏系统错误详情
 * 5. 注册全局异常监听钩子
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private static hookRegistered = false; // 防止重复注册

  constructor(
    @Inject(TelegramAlertService)
    private readonly telegramAlert?: TelegramAlertService,
  ) {
    // 延迟注册钩子，确保服务已初始化
    setImmediate(() => {
      this.registerCatchAllExceptionsHook();
    });
  }

  /**
   * 捕获异常并处理
   * @param exception 异常对象
   * @param host 参数主机
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const url = request.raw.url;

    const status = this.getStatus(exception);
    let message = this.getErrorMessage(exception);

    // 系统内部错误时
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof BusinessException)) {
      this.logger.error(`错误信息：(${status}) ${message} Path: ${decodeURI(url)}`);

      // 发送 Telegram 告警
      this.sendTelegramAlert(exception, url, request);

      // 生产环境下隐藏错误信息
      if (!isDev) message = 'Internal server error';
    } else {
      this.logger.warn(`错误信息：(${status}) ${message} Path: ${decodeURI(url)}`);
    }

    const apiErrorCode = exception instanceof BusinessException ? exception.getErrorCode() : status;

    response.status(status).send({
      code: apiErrorCode,
      message,
      data: null,
    });
  }

  /**
   * 获取 HTTP 状态码
   * @param exception 异常对象
   */
  getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    } else if (exception instanceof QueryFailedError) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    } else {
      return (
        (exception as MyError)?.status ??
        (exception as MyError)?.statusCode ??
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取错误消息
   * @param exception 异常对象
   */
  getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      return exception.message;
    } else if (exception instanceof QueryFailedError) {
      return exception.message;
    } else {
      return (
        (exception as any)?.response?.message ?? (exception as MyError)?.message ?? `${exception}`
      );
    }
  }

  /**
   * 注册全局异常监听钩子
   * 捕获未处理的 Promise 拒绝和未捕获的异常
   */
  registerCatchAllExceptionsHook() {
    // 防止重复注册
    if (AllExceptionsFilter.hookRegistered) {
      return;
    }
    AllExceptionsFilter.hookRegistered = true;

    process.on('unhandledRejection', (reason) => {
      this.logger.error('unhandledRejection: ', reason);
      this.sendTelegramAlert(reason, 'unhandledRejection');
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('uncaughtException: ', error);
      this.sendTelegramAlert(error, 'uncaughtException');
    });
  }

  /**
   * 发送 Telegram 告警
   */
  private sendTelegramAlert(exception: unknown, url: string, request?: FastifyRequest): void {
    if (!this.telegramAlert) {
      return;
    }

    // 异步发送，不阻塞响应
    setImmediate(async () => {
      try {
        const errorMessage = this.getErrorMessage(exception);
        const context: any = { url };

        if (request) {
          context.method = request.method;
          context.ip = request.ip;
        }

        if (exception instanceof Error && exception.stack) {
          context.stack = exception.stack.split('\n').slice(0, 5).join('\n');
        }

        await this.telegramAlert.sendErrorAlert('系统异常', errorMessage, context);
      } catch (error) {
        // 发送告警失败不影响主流程，只记录日志
        this.logger.debug('发送 Telegram 告警失败', error);
      }
    });
  }
}
