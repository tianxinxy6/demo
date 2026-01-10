import { TronScanService } from '@/modules/transaction/services/scan/tron.service';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronErrorHandler } from '@/common/decorators/cron-error-handler.decorator';

@Injectable()
export class ScanTask {
  constructor(private readonly tronScanService: TronScanService) {}

  /**
   * TRON 交易监控 - 每3秒执行一次
   */
  @Cron('*/3 * * * * *')
  @CronErrorHandler('TRON区块扫描')
  async scanTron(): Promise<void> {
    await this.tronScanService.scanBlock();
  }
}
