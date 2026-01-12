import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceTransaction, TransactionType } from './balance-transaction.entity';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class BalancesService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,

    @InjectRepository(BalanceTransaction)
    private readonly txRepo: Repository<BalanceTransaction>,
  ) {}

  // 🔹 GET /balances/:userId
  async getBalance(userId: number) {
    const balance = await this.balanceRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!balance) {
      throw new BadRequestException('Баланс не найден');
    }

    return balance;
  }

  // 🆕 GET /balances/:userId/add/:amount
  async addBalance(userId: number, amount: number) {
    const balance = await this.balanceRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!balance) {
      throw new BadRequestException('Баланс не найден');
    }

    balance.amount = Number(balance.amount) + Number(amount);
    await this.balanceRepo.save(balance);

    await this.txRepo.save(
      this.txRepo.create({
        user: balance.user,
        type: TransactionType.CREDIT,
        amount,
        reason: 'add_balance',
      }),
    );

    return balance;
  }

  // 🔹 POST /balances/transfer
  async transfer(dto: TransferDto) {
    const from = await this.balanceRepo.findOne({
      where: { user: { id: dto.fromUserId } },
      relations: ['user'],
    });

    const to = await this.balanceRepo.findOne({
      where: { user: { id: dto.toUserId } },
      relations: ['user'],
    });

    if (!from || !to) {
      throw new BadRequestException('Пользователь не найден');
    }

    if (+from.amount < dto.amount) {
      throw new BadRequestException('Недостаточно средств');
    }

    from.amount = Number(from.amount) - Number(dto.amount);
    to.amount = Number(to.amount) + Number(dto.amount);


    await this.balanceRepo.save([from, to]);

    await this.txRepo.save([
      this.txRepo.create({
        user: from.user,
        type: TransactionType.DEBIT,
        amount: dto.amount,
        reason: 'transfer',
      }),
      this.txRepo.create({
        user: to.user,
        type: TransactionType.CREDIT,
        amount: dto.amount,
        reason: 'transfer',
      }),
    ]);

    return { success: true };
  }
}

