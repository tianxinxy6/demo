import { IsString, IsNumber, Min } from 'class-validator';

export class CreateDelegateOrderDto {
  @IsString()
  orderNo: string;

  @IsNumber()
  userId: number;

  @IsString()
  receiverAddress: string;

  @IsNumber()
  @Min(32000)
  energyAmount: number;

  trxAmount: number;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsNumber()
  @Min(0)
  price: number;
}
