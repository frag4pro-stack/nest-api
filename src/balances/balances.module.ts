import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './balance.entity';
import { BalanceTransaction } from './balance-transaction.entity';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Balance, BalanceTransaction])],
  providers: [BalancesService],
  controllers: [BalancesController],
})
export class BalancesModule {}
