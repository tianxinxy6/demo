import { ApiProperty } from '@nestjs/swagger';

export class RentEnergyResponse {
  @ApiProperty({ description: '订单号' })
  orderNo: string;

  @ApiProperty({ description: '能量数量' })
  energyAmount: number;

  @ApiProperty({ description: '接收地址' })
  receiverAddress: string;

  @ApiProperty({ description: '价格(TRX)' })
  price: number;

  @ApiProperty({ description: '租赁时长(秒)' })
  duration: number;

  @ApiProperty({ description: '订单状态' })
  status: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '到期时间', required: false })
  expireAt?: Date;
}
