import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { CreateMerchantDto } from '../dto/create-merchant.dto';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';

/**
 * Admin 控制器 - 内部应用调用
 *
 * 用于内部应用（如后台管理系统）调用的 API
 * 需要通过 API Key + HMAC 签名验证
 */
@Controller({ path: 'admin', version: '' })
@UseGuards(ApiKeyGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 创建商户
   *
   * 为指定用户创建商户账号，生成 API Key 和 Secret
   * 用于用户接入 API 进行程序化交易
   */
  @Post('merchant')
  async createMerchant(@Body() dto: CreateMerchantDto): Promise<void> {
    this.adminService.createMerchant(dto);
  }
}
