import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { MerchantEntity } from '@/entities/merchant.entity';
import { UserEntity } from '@/entities/user.entity';
import { UserModule } from '../user/user.module';

/**
 * Admin 模块 - 内部应用调用
 *
 * 用于内部应用（如后台管理系统）之间的 API 调用
 * 采用 API Key + HMAC 签名的安全机制
 */
@Module({
  imports: [TypeOrmModule.forFeature([MerchantEntity, UserEntity]), UserModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
