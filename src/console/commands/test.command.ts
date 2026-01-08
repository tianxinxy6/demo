import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';

/**
 * 测试命令示例
 * 使用方式: npm run console test -- --name=张三
 */
interface TestCommandOptions {
  name?: string;
}

@Injectable()
@Command({
  name: 'test',
  description: '测试命令示例',
})
export class TestCommand extends CommandRunner {
  async run(passedParams: string[], options?: TestCommandOptions): Promise<void> {
    const name = options?.name || '世界';
    console.log(`你好, ${name}!`);
    console.log('这是一个测试命令');

    if (passedParams.length > 0) {
      console.log('接收到的参数:', passedParams);
    }
  }

  @Option({
    flags: '-n, --name <name>',
    description: '名称参数',
  })
  parseName(val: string): string {
    return val;
  }
}
