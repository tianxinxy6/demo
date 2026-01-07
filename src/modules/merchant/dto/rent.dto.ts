import { IsString, IsNumber, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RentEnergyDto {
  @ApiProperty({ description: '接收能量的地址' })
  @IsString()
  receiverAddress: string;

  @ApiProperty({ description: '能量数量', minimum: 32000 })
  @IsNumber()
  @Min(32000)
  energyAmount: number;

  @ApiProperty({ description: '租赁时长(分钟)', enum: [10, 60, 1440] })
  @IsNumber()
  @IsIn([10, 60, 1440])
  duration: number;
}

export class ReclaimEnergyDto {
  @ApiProperty({ description: '订单号' })
  @IsString()
  orderNo: string;
}
