import { Controller, Get, Param, Post, Body, ParseIntPipe } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { TransferDto } from './dto/transfer.dto';

@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  // 🔹 Получить баланс
  @Get(':userId')
  getBalance(@Param('userId', ParseIntPipe) userId: number) {
    return this.balancesService.getBalance(userId);
  }

  // 🔹 Перевод средств
  @Post('transfer')
  transfer(@Body() dto: TransferDto) {
    return this.balancesService.transfer(dto);
  }

  // 🔹 Начисление средств (изменяет состояние → POST)
  @Post(':userId/add/:amount')
  addBalance(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('amount', ParseIntPipe) amount: number,
  ) {
    return this.balancesService.addBalance(userId, amount);
  }
}

