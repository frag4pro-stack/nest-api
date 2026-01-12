import { IsNumber, IsPositive } from 'class-validator';

export class TransferDto {
  @IsNumber()
  fromUserId: number;

  @IsNumber()
  toUserId: number;

  @IsPositive()
  amount: number;
}
