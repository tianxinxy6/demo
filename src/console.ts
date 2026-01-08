import { CommandFactory } from 'nest-commander';
import { ConsoleModule } from './console/console.module';

/**
 * Console 入口文件
 * 类似于 Laravel 的 php artisan
 *
 * 使用方式:
 * npm run console <command> [options]
 *
 * 查看所有命令:
 * npm run console -- --help
 */
async function bootstrap() {
  await CommandFactory.run(ConsoleModule, {
    logger: ['error', 'warn'],
  });
}

bootstrap();
