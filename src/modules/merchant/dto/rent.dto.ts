import { IsString, IsNumber, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 租赁能量请求参数
 */
export class RentEnergyDto {
  @ApiProperty({
    description: '接收能量的TRON地址',
    example: 'TY2uroBeZ5tmKExHadCwb4MkWz9mKHYN7g',
    required: true,
  })
  @IsString()
  receiverAddress: string;

  @ApiProperty({
    description: '租赁能量数量（单位：能量），最小32000',
    example: 65000,
    minimum: 32000,
    required: true,
  })
  @IsNumber()
  @Min(32000, { message: '能量数量不能小于32000' })
  energyAmount: number;

  @ApiProperty({
    description: '租赁时长（分钟），可选值：10分钟、60分钟（1小时）、1440分钟（1天）',
    example: 60,
    enum: [10, 60, 1440],
    required: true,
  })
  @IsNumber()
  @IsIn([10, 60, 1440], { message: '租赁时长必须是10、60或1440分钟' })
  minutes: number;
}

/**
 * 回收能量请求参数
 */
export class ReclaimEnergyDto {
  @ApiProperty({
    description: '订单号',
    example: 'DG202601081234567890',
    required: true,
  })
  @IsString()
  orderNo: string;
}
