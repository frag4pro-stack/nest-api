import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceTransaction, TransactionType } from './balance-transaction.entity';
import { TransferDto } from './dto/transfer.dto';
import { DataSource } from 'typeorm';

@Injectable()
export class BalancesService {
  constructor(
  @InjectRepository(Balance)
  private readonly balanceRepo: Repository<Balance>,

  @InjectRepository(BalanceTransaction)
  private readonly txRepo: Repository<BalanceTransaction>,

  private readonly dataSource: DataSource, // ← ВОТ ЭТО ДОБАВИТЬ
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

  //Гарантия целостности транзакции 🔹 POST /balances/transfer
 async transfer(dto: TransferDto) {
  await this.dataSource.transaction(async (manager) => {

    // Блокируем баланс отправителя
    const from = await manager
      .createQueryBuilder(Balance, 'b')
      .setLock('pessimistic_write')
      .where('b.userId = :userId', { userId: dto.fromUserId })
      .getOne();

    // Блокируем баланс получателя
    const to = await manager
      .createQueryBuilder(Balance, 'b')
      .setLock('pessimistic_write')
      .where('b.userId = :userId', { userId: dto.toUserId })
      .getOne();

    if (!from || !to) {
      throw new BadRequestException('Пользователь не найден');
    }

    if (+from.amount < dto.amount) {
      throw new BadRequestException('Недостаточно средств');
    }

    from.amount = Number(from.amount) - Number(dto.amount);
    to.amount   = Number(to.amount)   + Number(dto.amount);

    await manager.save([from, to]);

    // Лог транзакции — БЕЗ join’ов
    await manager.save(BalanceTransaction, [
      manager.create(BalanceTransaction, {
        userId: dto.fromUserId,
        type: TransactionType.DEBIT,
        amount: dto.amount,
        reason: 'transfer',
      }),
      manager.create(BalanceTransaction, {
        userId: dto.toUserId,
        type: TransactionType.CREDIT,
        amount: dto.amount,
        reason: 'transfer',
      }),
    ]);
  });

  return { success: true };
 }
}
