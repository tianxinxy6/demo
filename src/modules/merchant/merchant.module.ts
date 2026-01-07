import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantEntity } from '@/entities/merchant.entity';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { UserWalletEntity } from '@/entities/user-wallet.entity';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantService } from './services/merchant.service';
import { UserModule } from '../user/user.module';
import { SysModule } from '../sys/sys.module';
import { OrderModule } from '../order/order.module';
import { ChainModule } from '../chain/chain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerchantEntity, SysWalletAddressEntity, UserWalletEntity]),
    UserModule,
    SysModule,
    OrderModule,
    ChainModule,
  ],
  controllers: [MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
