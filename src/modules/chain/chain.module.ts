import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ChainTokenService } from './services/token.service';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { SharedModule } from '@/shared/shared.module';
import { ChainController } from './controllers/chain.controller';

const providers = [ChainTokenService];

@Module({
  imports: [TypeOrmModule.forFeature([ChainTokenEntity]), ConfigModule, HttpModule, SharedModule],
  controllers: [ChainController],
  providers,
  exports: providers,
})
export class ChainModule {}
