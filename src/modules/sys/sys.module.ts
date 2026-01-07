import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenPriceEntity } from '@/entities/token-price.entity';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { SharedModule } from '@/shared/shared.module';
import { TokenPriceService } from './services/token-price.service';
import { SysWalletAddressService } from './services/sys-wallet.service';

const services = [TokenPriceService, SysWalletAddressService];

@Module({
  imports: [TypeOrmModule.forFeature([TokenPriceEntity, SysWalletAddressEntity]), SharedModule],
  providers: services,
  exports: services,
})
export class SysModule {}
