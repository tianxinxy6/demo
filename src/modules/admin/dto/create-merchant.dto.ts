import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 创建商户 DTO
 */
export class CreateMerchantDto {
  @ApiProperty({
    description: '商户名称',
    example: '测试商户',
  })
  @IsString()
  @IsNotEmpty({ message: '商户名称不能为空' })
  name: string;
}
