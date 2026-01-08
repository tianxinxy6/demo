import { ApiProperty } from '@nestjs/swagger';

/**
 * 租赁能量响应数据
 */
export class RentEnergyResponse {
  @ApiProperty({
    description: '订单号，全局唯一标识',
    example: 'DG202601081234567890',
  })
  orderNo: string;

  @ApiProperty({
    description: '租赁的能量数量（单位：能量）',
    example: 65000,
  })
  energyAmount: number;

  @ApiProperty({
    description: '接收能量的TRON地址',
    example: 'TY2uroBeZ5tmKExHadCwb4MkWz9mKHYN7g',
  })
  receiverAddress: string;

  @ApiProperty({
    description: '租赁价格（单位：TRX）',
    example: 6.5,
  })
  price: number;

  @ApiProperty({
    description: '租赁时长（单位：秒）',
    example: 3600,
  })
  duration: number;
}
